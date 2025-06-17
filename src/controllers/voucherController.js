// backend-api/src/controllers/voucherController.js
const db = require('../db');


// Fungsi helper untuk generate kode acak
function generateRandomString(length) {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Hindari karakter yg mirip (I,1,O,0)
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Fungsi BARU untuk Generate Voucher Massal
exports.generateBatchVouchers = async (req, res) => {
    const { 
        count = 10, 
        prefix = '', 
        description, 
        value, 
        expiry_date = null 
    } = req.body;

    console.log("VOUCHER_CONTROLLER: generateBatchVouchers dipanggil dengan data:", req.body);

    // Validasi Input
    if (!description || typeof value === 'undefined') {
        return res.status(400).json({ success: false, message: 'Deskripsi dan Nilai voucher harus diisi.' });
    }
    const numCount = parseInt(count, 10);
    if (isNaN(numCount) || numCount < 1 || numCount > 200) {
        return res.status(400).json({ success: false, message: 'Jumlah (count) harus antara 1 dan 200.' });
    }

    const client = await db.pool.connect();
    const generatedVouchers = [];

    try {
        await client.query('BEGIN');

        for (let i = 0; i < numCount; i++) {
            // Buat kode unik: PREFIX + 8 karakter acak
            // Tambahkan loop untuk memastikan keunikan jika ada kemungkinan duplikasi
            let uniqueCode;
            let isUnique = false;
            let attempt = 0;
            while (!isUnique && attempt < 10) { // Coba max 10 kali jika ada duplikasi
                uniqueCode = (prefix ? prefix.toUpperCase().trim() : '') + generateRandomString(8);
                const { rows } = await client.query('SELECT id FROM vouchers WHERE code = $1', [uniqueCode]);
                if (rows.length === 0) {
                    isUnique = true;
                }
                attempt++;
            }

            if (!isUnique) {
                throw new Error("Gagal membuat kode unik setelah beberapa percobaan. Coba lagi atau ganti prefix.");
            }

            // Insert voucher baru ke database
            const { rows: insertedRows } = await client.query(
                `INSERT INTO vouchers (code, description, type, value, expiry_date, usage_limit, times_used, is_active)
                 VALUES ($1, $2, 'fixed', $3, $4, 1, 0, TRUE)
                 RETURNING *`,
                [uniqueCode, description, value, expiry_date || null]
            );
            generatedVouchers.push(insertedRows[0]);
        }
        
        await client.query('COMMIT');
        console.log(`VOUCHER_CONTROLLER: ${generatedVouchers.length} voucher massal berhasil dibuat.`);
        res.status(201).json({ 
            success: true, 
            message: `${generatedVouchers.length} voucher sekali pakai berhasil dibuat.`,
            data: generatedVouchers.map(v => v.code) // Kirim kembali daftar kode yang dibuat
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('VOUCHER_CONTROLLER: Error membuat voucher massal:', error);
        res.status(500).json({ success: false, message: 'Gagal membuat voucher massal: ' + error.message });
    } finally {
        client.release();
    }
};

// Fungsi ini sudah ada, untuk Electron app memvalidasi voucher
exports.validateVoucher = async (req, res) => {
    const { voucher_code, base_amount } = req.body;

    if (!voucher_code || typeof base_amount === 'undefined') {
        return res.status(400).json({ success: false, message: 'Kode voucher dan harga dasar harus diisi.' });
    }
    const baseAmountNum = parseFloat(base_amount);
    if (isNaN(baseAmountNum)) {
        return res.status(400).json({ success: false, message: 'Harga dasar tidak valid.' });
    }

    try {
        // PERBAIKAN QUERY: Tambahkan pengecekan usage_limit dan times_used
        const queryText = `
            SELECT id, code, type, value, description, min_purchase, max_discount, 
                   expiry_date, is_active, usage_limit, times_used 
            FROM vouchers 
            WHERE UPPER(code) = UPPER($1) AND is_active = TRUE
        `;
        const { rows } = await db.query(queryText, [voucher_code]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: `Kode voucher "${voucher_code}" tidak ditemukan atau tidak aktif.` });
        }
        const voucher = rows[0];

        // PENGECEKAN BARU: Validasi batas penggunaan
        if (voucher.usage_limit !== null && voucher.times_used >= voucher.usage_limit) {
            return res.status(400).json({ success: false, message: `Kode voucher "${voucher_code}" sudah mencapai batas penggunaan.` });
        }

        if (voucher.expiry_date) {
            const today = new Date();
            const expiry = new Date(voucher.expiry_date);
            today.setHours(0, 0, 0, 0);
            expiry.setHours(23, 59, 59, 999);
            if (today > expiry) {
                return res.json({ success: false, message: `Kode voucher "${voucher_code}" sudah kedaluwarsa.` });
            }
        }

        if (voucher.min_purchase && baseAmountNum < parseFloat(voucher.min_purchase)) {
            return res.json({ success: false, message: `Voucher "${voucher_code}" memerlukan pembelian minimum Rp ${parseFloat(voucher.min_purchase).toLocaleString('id-ID')}.` });
        }

        let discountApplied = 0;
        let finalAmount = baseAmountNum;

        if (voucher.type === "fixed") {
            discountApplied = parseFloat(voucher.value);
        } else if (voucher.type === "percentage") {
            let calculatedDiscount = baseAmountNum * parseFloat(voucher.value);
            if (voucher.max_discount && calculatedDiscount > parseFloat(voucher.max_discount)) {
                calculatedDiscount = parseFloat(voucher.max_discount);
            }
            discountApplied = calculatedDiscount;
        } else {
            return res.status(500).json({ success: false, message: 'Tipe voucher tidak dikenal di database.' });
        }
        
        finalAmount = baseAmountNum - discountApplied;
        if (finalAmount < 0) {
            finalAmount = 0;
            discountApplied = baseAmountNum;
        }
        
        finalAmount = Math.round(finalAmount);
        discountApplied = Math.round(discountApplied);

        res.json({
            success: true,
            message: `${voucher.description} diterapkan.`,
            finalAmount: finalAmount,
            discountApplied: discountApplied,
            voucherDetails: { code: voucher.code, description: voucher.description, type: voucher.type, value: voucher.value }
        });
    } catch (error) {
        console.error('Error saat validasi voucher:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat validasi voucher.' });
    }
};

// --- Endpoint untuk Web Admin ---

// Membuat Voucher Baru
exports.createVoucher = async (req, res) => {
    // Ambil data dari body request
    // Pastikan validasi input yang baik di sini
    const {
        code, description, type, value,
        min_purchase = 0, max_discount = null, expiry_date = null,
        usage_limit = null, is_active = true
    } = req.body;

    if (!code || !type || typeof value === 'undefined') {
        return res.status(400).json({ success: false, message: 'Kode, tipe, dan nilai voucher harus diisi.' });
    }
    if (type !== 'fixed' && type !== 'percentage') {
        return res.status(400).json({ success: false, message: "Tipe voucher harus 'fixed' atau 'percentage'." });
    }
     console.log("VOUCHER_CONTROLLER: createVoucher dipanggil.");
    console.log("VOUCHER_CONTROLLER: req.body yang diterima:", req.body);

    try {
        const { rows } = await db.query(
            `INSERT INTO vouchers (code, description, type, value, min_purchase, max_discount, expiry_date, usage_limit, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [code.toUpperCase(), description, type, value, min_purchase, max_discount, expiry_date, usage_limit, is_active]
        );
        res.status(201).json({ success: true, message: 'Voucher berhasil dibuat.', data: rows[0] });
    } catch (error) {
        console.error('Error membuat voucher:', error);
        if (error.code === '23505') { // Unique violation
            return res.status(409).json({ success: false, message: 'Kode voucher sudah ada.' });
        }
        res.status(500).json({ success: false, message: 'Gagal membuat voucher.' });
    }
};

// Mendapatkan Semua Voucher
exports.getAllVouchers = async (req, res) => {
    try {
        const { rows } = await db.query('SELECT * FROM vouchers ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error mendapatkan semua voucher:', error);
        res.status(500).json({ success: false, message: 'Gagal mendapatkan data voucher.' });
    }
};

// Mengupdate Voucher
exports.updateVoucher = async (req, res) => {
    const { id } = req.params;
    const {
        code, description, type, value,
        min_purchase, max_discount, expiry_date,
        usage_limit, is_active, times_used // times_used mungkin direset atau tidak diupdate dari sini
    } = req.body;

    // Validasi dasar
    if (!code && !description && !type && typeof value === 'undefined' &&
        typeof min_purchase === 'undefined' && typeof max_discount === 'undefined' && !expiry_date &&
        typeof usage_limit === 'undefined' && typeof is_active === 'undefined') {
        return res.status(400).json({ success: false, message: 'Tidak ada data untuk diupdate.' });
    }

    try {
        // Bangun query update secara dinamis (lebih aman dan fleksibel)
        const fields = [];
        const values = [];
        let queryIndex = 1;

        if (code) { fields.push(`code = $${queryIndex++}`); values.push(code.toUpperCase()); }
        if (description) { fields.push(`description = $${queryIndex++}`); values.push(description); }
        if (type) { fields.push(`type = $${queryIndex++}`); values.push(type); }
        if (typeof value !== 'undefined') { fields.push(`value = $${queryIndex++}`); values.push(value); }
        if (typeof min_purchase !== 'undefined') { fields.push(`min_purchase = $${queryIndex++}`); values.push(min_purchase); }
        if (max_discount === null || typeof max_discount !== 'undefined') { fields.push(`max_discount = $${queryIndex++}`); values.push(max_discount); }
        if (expiry_date === null || expiry_date) { fields.push(`expiry_date = $${queryIndex++}`); values.push(expiry_date); }
        if (typeof usage_limit !== 'undefined') { fields.push(`usage_limit = $${queryIndex++}`); values.push(usage_limit); }
        if (typeof is_active !== 'undefined') { fields.push(`is_active = $${queryIndex++}`); values.push(is_active); }
        if (typeof times_used !== 'undefined') { fields.push(`times_used = $${queryIndex++}`); values.push(times_used); }


        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: 'Tidak ada field valid untuk diupdate.' });
        }
        
        fields.push(`updated_at = NOW()`); // Selalu update updated_at

        const updateQuery = `UPDATE vouchers SET ${fields.join(', ')} WHERE id = $${queryIndex} RETURNING *`;
        values.push(id);

        const { rows } = await db.query(updateQuery, values);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Voucher tidak ditemukan.' });
        }
        res.json({ success: true, message: 'Voucher berhasil diupdate.', data: rows[0] });
    } catch (error) {
        console.error(`Error mengupdate voucher ID ${id}:`, error);
        if (error.code === '23505') { // Unique violation untuk kode voucher
            return res.status(409).json({ success: false, message: 'Kode voucher sudah digunakan oleh voucher lain.' });
        }
        res.status(500).json({ success: false, message: 'Gagal mengupdate voucher.' });
    }
};

// Menghapus Voucher (sekarang menjadi hapus permanen)
exports.deleteVoucher = async (req, res) => {
    const { id } = req.params;
    console.log(`VOUCHER_CONTROLLER: deleteVoucher dipanggil untuk ID: ${id}`);
    try {
        // Hapus permanen dari database
        const result = await db.query('DELETE FROM vouchers WHERE id = $1 RETURNING *', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Voucher tidak ditemukan untuk dihapus.' });
        }
        res.json({ success: true, message: 'Voucher berhasil dihapus secara permanen.'});

    } catch (error) {
        console.error(`Error menghapus voucher ID ${id}:`, error);
        // Tangani jika ada foreign key constraint violation
        if (error.code === '23503') {
             return res.status(409).json({ success: false, message: 'Gagal menghapus: Voucher ini masih terkait dengan data transaksi.' });
        }
        res.status(500).json({ success: false, message: 'Gagal menghapus voucher karena kesalahan server.' });
    }
};

// Fungsi BARU untuk menghapus semua voucher yang sudah habis terpakai
exports.deleteUsedUpVouchers = async (req, res) => {
    console.log("VOUCHER_CONTROLLER: deleteUsedUpVouchers dipanggil.");
    try {
        // Hapus voucher di mana usage_limit tidak NULL (memiliki batas) dan times_used sudah mencapai atau melebihi limit tersebut.
        const result = await db.query(
            `DELETE FROM vouchers 
             WHERE usage_limit IS NOT NULL AND times_used >= usage_limit 
             RETURNING id`
        );
        
        const deletedCount = result.rowCount;

        if (deletedCount === 0) {
            return res.json({ success: true, message: 'Tidak ada voucher habis pakai yang ditemukan untuk dihapus.' });
        }

        res.json({ success: true, message: `${deletedCount} voucher yang sudah habis pakai berhasil dihapus.` });

    } catch (error) {
        console.error('Error menghapus voucher habis pakai:', error);
        res.status(500).json({ success: false, message: 'Gagal membersihkan voucher habis pakai.' });
    }
};
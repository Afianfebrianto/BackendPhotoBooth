// backend-api/src/controllers/cashCodeController.js
const db = require('../db');
const ExcelJS = require('exceljs');



// Fungsi untuk memformat tanggal untuk nama file dan tampilan
function formatDateForFilename(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    const hours = ('0' + d.getHours()).slice(-2);
    const minutes = ('0' + d.getMinutes()).slice(-2);
    return `${year}${month}${day}_${hours}${minutes}`;
}

function formatDateForDisplay(dateString) {
    if (!dateString) return '-';
    try {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    } catch (e) {
        return dateString;
    }
}

function generateSingleUniqueCode(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `CASH-${result}`;
    // TODO: Pastikan kode ini benar-benar unik di database, mungkin perlu loop cek
}


// Fungsi BARU untuk Generate Batch Kode Pembayaran Cash
exports.generateBatchCashCodes = async (req, res) => {
    const { count = 1, amount, voucher_code, expiry_date_input } = req.body;
    const created_by = req.user.userId; // Diambil dari token JWT setelah otentikasi

    console.log("CASH_CODE_CONTROLLER: generateBatchCashCodes dipanggil. Data:", req.body, "User ID:", created_by);

    if (isNaN(parseInt(count)) || parseInt(count) < 1 || parseInt(count) > 100) { // Batasi jumlah per request
        return res.status(400).json({ success: false, message: 'Jumlah kode (count) harus antara 1 dan 100.' });
    }
    if (typeof amount === 'undefined' || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Jumlah pembayaran per kode (amount) harus valid dan positif.' });
    }

    const baseAmountPerCode = parseFloat(amount); // Ini adalah harga dasar sebelum voucher
    let finalAmountPerCode = baseAmountPerCode;
    let discountAppliedPerCode = 0;
    let appliedVoucherId = null;
    let voucherDetailsForResponse = null; // Untuk menyimpan detail voucher yang berhasil diterapkan

    // Validasi voucher jika ada (berlaku untuk semua kode yang digenerate dalam batch ini)
    if (voucher_code && voucher_code.trim() !== '') {
        console.log(`CASH_CODE_CONTROLLER: Memvalidasi voucher: ${voucher_code} untuk baseAmount: ${baseAmountPerCode}`);
        try {
            const { rows: voucherRows } = await db.query(
                'SELECT id, code, type, value, description, min_purchase, max_discount, expiry_date, is_active FROM vouchers WHERE UPPER(code) = UPPER($1) AND is_active = TRUE',
                [voucher_code]
            );
            if (voucherRows.length > 0) {
                const voucher = voucherRows[0];
                console.log("CASH_CODE_CONTROLLER: Voucher ditemukan:", voucher);

                // Validasi tanggal kedaluwarsa voucher
                if (voucher.expiry_date) {
                    const today = new Date(); 
                    const expiry = new Date(voucher.expiry_date);
                    today.setHours(0,0,0,0); 
                    expiry.setHours(23,59,59,999);
                    if (today > expiry) {
                        return res.status(400).json({ success: false, message: `Kode voucher "${voucher_code}" sudah kedaluwarsa.` });
                    }
                }
                // Validasi pembelian minimum voucher
                if (voucher.min_purchase && baseAmountPerCode < parseFloat(voucher.min_purchase)) {
                    return res.status(400).json({ success: false, message: `Voucher "${voucher_code}" memerlukan pembelian minimum Rp ${parseFloat(voucher.min_purchase).toLocaleString('id-ID')}.` });
                }

                // Hitung diskon
                if (voucher.type === "fixed") {
                    discountAppliedPerCode = parseFloat(voucher.value);
                } else if (voucher.type === "percentage") {
                    let calcDiscount = baseAmountPerCode * parseFloat(voucher.value);
                    if (voucher.max_discount && calcDiscount > parseFloat(voucher.max_discount)) {
                        calcDiscount = parseFloat(voucher.max_discount);
                    }
                    discountAppliedPerCode = calcDiscount;
                }
                finalAmountPerCode = baseAmountPerCode - discountAppliedPerCode;
                if (finalAmountPerCode < 0) { 
                    finalAmountPerCode = 0; 
                    discountAppliedPerCode = baseAmountPerCode; 
                }
                
                finalAmountPerCode = Math.round(finalAmountPerCode);
                discountAppliedPerCode = Math.round(discountAppliedPerCode);
                appliedVoucherId = voucher.id;
                voucherDetailsForResponse = { code: voucher.code, description: voucher.description }; // Simpan detail untuk respons
                console.log(`CASH_CODE_CONTROLLER: Voucher valid. Diskon per kode: ${discountAppliedPerCode}, Final per kode: ${finalAmountPerCode}`);
            } else {
                return res.status(400).json({ success: false, message: `Kode voucher "${voucher_code}" tidak valid atau tidak aktif.` });
            }
        } catch (voucherError) {
            console.error("CASH_CODE_CONTROLLER: Error validasi voucher internal:", voucherError);
            return res.status(400).json({ success: false, message: voucherError.message || "Gagal memvalidasi voucher." });
        }
    }

    // Tentukan tanggal kadaluwarsa untuk kode cash
    let expiresAtTimestamp = null;
    if (expiry_date_input && expiry_date_input.trim() !== '') { // Cek juga string kosong
        try {
            const parsedDate = new Date(expiry_date_input);
            if (!isNaN(parsedDate.getTime())) { // Cek apakah tanggal valid
                parsedDate.setHours(23, 59, 59, 999); // Set ke akhir hari
                expiresAtTimestamp = parsedDate;
            } else {
                 console.warn("CASH_CODE_CONTROLLER: Format tanggal kadaluwarsa tidak valid, akan diabaikan:", expiry_date_input);
            }
        } catch (dateError) {
            console.warn("CASH_CODE_CONTROLLER: Error parsing tanggal kadaluwarsa, akan diabaikan:", dateError);
        }
    }

    const generatedCodesData = [];
    const client = await db.pool.connect(); 

    try {
        await client.query('BEGIN');
        for (let i = 0; i < parseInt(count); i++) {
            let uniqueCashCode = generateSingleUniqueCode();
            // TODO: Implementasi loop untuk memastikan keunikan kode jika generateSingleUniqueCode tidak cukup
            // (misalnya, query ke DB untuk cek apakah kode sudah ada, jika ya, generate lagi)
            
            const { rows } = await client.query(
                `INSERT INTO cash_payment_codes 
                (code, amount, status, created_by, expires_at, base_amount, discount_applied, voucher_id)
                VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, $7)
                RETURNING id, code, amount, status, expires_at, base_amount, discount_applied, voucher_id`,
                [
                    uniqueCashCode, 
                    finalAmountPerCode, 
                    created_by, 
                    expiresAtTimestamp, 
                    baseAmountPerCode, 
                    discountAppliedPerCode, 
                    appliedVoucherId
                ]
            );
            if (rows[0]) {
                generatedCodesData.push({
                    ...rows[0], // Ambil semua field yang di-return
                    amount: parseFloat(rows[0].amount), // Pastikan tipe data angka
                    baseAmount: parseFloat(rows[0].base_amount),
                    discountApplied: parseFloat(rows[0].discount_applied),
                    appliedVoucherCode: voucherDetailsForResponse ? voucherDetailsForResponse.code : null, // Tambahkan kode voucher yang dipakai
                    voucherDescription: voucherDetailsForResponse ? voucherDetailsForResponse.description : null // Tambahkan deskripsi voucher
                });
            }
        }
        await client.query('COMMIT');
        console.log(`CASH_CODE_CONTROLLER: ${generatedCodesData.length} kode cash berhasil dibuat di DB.`);
        res.status(201).json({
            success: true,
            message: `${generatedCodesData.length} kode pembayaran cash berhasil dibuat.`,
            data: generatedCodesData // Kirim array dari kode yang berhasil dibuat
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('CASH_CODE_CONTROLLER: Error membuat batch kode pembayaran cash di DB:', error);
        res.status(500).json({ success: false, message: 'Gagal membuat batch kode pembayaran cash karena kesalahan server.' });
    } finally {
        client.release();
    }
};

// Fungsi redeemCashCode tetap seperti sebelumnya
exports.redeemCashCode = async (req, res) => {
    const { cash_code } = req.body;
    const electron_app_id = req.headers['x-electron-app-id'] || null;

    if (!cash_code) {
        return res.status(400).json({ success: false, message: 'Kode pembayaran cash harus diisi.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: codeRows } = await client.query(
            'SELECT id, code, amount, status, expires_at, base_amount, discount_applied, voucher_id FROM cash_payment_codes WHERE UPPER(code) = UPPER($1) FOR UPDATE', 
            [cash_code]
        );

        if (codeRows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: `Kode pembayaran "${cash_code}" tidak ditemukan.` });
        }

        const cashCodeData = codeRows[0];

        if (cashCodeData.status === 'REDEEMED') { 
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: `Kode pembayaran "${cash_code}" sudah digunakan.` });
        }
        if (cashCodeData.status === 'EXPIRED' || (cashCodeData.expires_at && new Date() > new Date(cashCodeData.expires_at))) { 
            if (cashCodeData.status !== 'EXPIRED') {
                await client.query("UPDATE cash_payment_codes SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1", [cashCodeData.id]);
            }
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: `Kode pembayaran "${cash_code}" sudah kedaluwarsa.` });
        }
        if (cashCodeData.status !== 'PENDING') { 
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: `Kode pembayaran "${cash_code}" tidak bisa digunakan (status: ${cashCodeData.status}).` });
        }

        // Gunakan data dari cash_payment_codes untuk mencatat transaksi
        const transactionData = {
            payment_method: 'CASH_CODE',
            status: 'PAID',
            base_amount: parseFloat(cashCodeData.base_amount || cashCodeData.amount), // Ambil base_amount, fallback ke amount jika null
            discount_applied: parseFloat(cashCodeData.discount_applied || 0),
            final_amount: parseFloat(cashCodeData.amount), // Ini adalah amount setelah diskon
            cash_payment_code_id: cashCodeData.id,
            voucher_id: cashCodeData.voucher_id, // Ambil voucher_id
            electron_merchant_ref: `CASH-${cashCodeData.code}-${Date.now()}`,
            paid_at: new Date()
            // customer_name, dll. bisa ditambahkan jika Electron app mengirimnya saat redeem
        };

        const { rows: transactionRows } = await client.query(
            `INSERT INTO transactions (electron_merchant_ref, payment_method, status, base_amount, discount_applied, final_amount, cash_payment_code_id, voucher_id, paid_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, final_amount`,
            [
                transactionData.electron_merchant_ref, transactionData.payment_method, transactionData.status,
                transactionData.base_amount, transactionData.discount_applied, transactionData.final_amount,
                transactionData.cash_payment_code_id, transactionData.voucher_id, transactionData.paid_at
            ]
        );
        
        const newTransactionId = transactionRows[0].id;

        // Update status kode cash menjadi REDEEMED dan simpan transaction_id
        await client.query(
            "UPDATE cash_payment_codes SET status = 'REDEEMED', redeemed_at = NOW(), electron_app_id = $1, transaction_id = $2, updated_at = NOW() WHERE id = $3",
            [electron_app_id, newTransactionId, cashCodeData.id]
        );

        await client.query('COMMIT');
        res.json({
            success: true,
            message: `Kode pembayaran "${cash_code}" berhasil ditebus.`,
            transactionId: newTransactionId,
            amountPaid: parseFloat(cashCodeData.amount)
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('CASH_CODE_CONTROLLER: Error saat redeem kode pembayaran cash:', error);
        res.status(500).json({ success: false, message: 'Gagal memproses kode pembayaran cash.' });
    } finally {
        client.release();
    }
};

// Fungsi BARU untuk mendapatkan Kode Cash yang Belum Terpakai (Status PENDING)
exports.getPendingCashCodes = async (req, res) => {
    console.log("CASH_CODE_CONTROLLER: getPendingCashCodes dipanggil.");
    try {
        const { rows } = await db.query(
            `SELECT cc.id, cc.code, cc.amount, cc.status, cc.created_at, cc.expires_at, 
                    cc.base_amount, cc.discount_applied, 
                    u.username as created_by_username, v.code as voucher_code_used
             FROM cash_payment_codes cc
             LEFT JOIN admin_users u ON cc.created_by = u.id
             LEFT JOIN vouchers v ON cc.voucher_id = v.id
             WHERE cc.status = 'PENDING' 
             ORDER BY cc.created_at DESC`
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('CASH_CODE_CONTROLLER: Error mendapatkan kode cash pending:', error);
        res.status(500).json({ success: false, message: 'Gagal mendapatkan data kode cash pending.' });
    }
};

// Fungsi BARU untuk Export Kode Cash Pending ke Excel
exports.exportPendingCashCodesToExcel = async (req, res) => {
    console.log("CASH_CODE_CONTROLLER: exportPendingCashCodesToExcel dipanggil.");
    try {
        // Query data yang sama dengan getPendingCashCodes
        const { rows: pendingCodes } = await db.query(
            `SELECT cc.id, cc.code, cc.amount, cc.status, cc.created_at, cc.expires_at, 
                    cc.base_amount, cc.discount_applied, 
                    u.username as created_by_username, v.code as voucher_code_used
             FROM cash_payment_codes cc
             LEFT JOIN admin_users u ON cc.created_by = u.id
             LEFT JOIN vouchers v ON cc.voucher_id = v.id
             WHERE cc.status = 'PENDING' 
             ORDER BY cc.created_at DESC`
        );

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Kode Cash Pending');

        // Definisikan header kolom
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Kode Cash', key: 'code', width: 20 },
            { header: 'Harga Asli (Rp)', key: 'base_amount', width: 20, style: { numFmt: '#,##0' } },
            { header: 'Diskon (Rp)', key: 'discount_applied', width: 15, style: { numFmt: '#,##0' } },
            { header: 'Total Bayar (Rp)', key: 'amount', width: 20, style: { numFmt: '#,##0' } },
            { header: 'Voucher Digunakan', key: 'voucher_code_used', width: 20 },
            { header: 'Dibuat Oleh', key: 'created_by_username', width: 20 },
            { header: 'Tgl. Dibuat', key: 'created_at', width: 25 },
            { header: 'Tgl. Kadaluwarsa', key: 'expires_at', width: 25 },
            { header: 'Status', key: 'status', width: 15 }
        ];
        
        // Tambahkan gaya pada header
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };

        // Tambahkan data baris
        pendingCodes.forEach(code => {
            worksheet.addRow({
                ...code,
                created_at: code.created_at ? formatDateForDisplay(code.created_at) : '-',
                expires_at: code.expires_at ? formatDateForDisplay(code.expires_at) : 'Tidak Terbatas',
                base_amount: code.base_amount ? parseFloat(code.base_amount) : 0,
                discount_applied: code.discount_applied ? parseFloat(code.discount_applied) : 0,
                amount: code.amount ? parseFloat(code.amount) : 0,
                voucher_code_used: code.voucher_code_used || '-'
            });
        });

        // Atur border untuk semua sel yang terisi
        worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
            row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' }
                };
            });
        });

        // Set header untuk respons download
        const timestamp = formatDateForFilename(new Date());
        const filename = `Laporan_Kode_Cash_Pending_${timestamp}.xlsx`;
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`); // Tambahkan kutip ganda untuk nama file

        await workbook.xlsx.write(res);
        res.end(); // Pastikan stream ditutup
        console.log(`CASH_CODE_CONTROLLER: File Excel ${filename} berhasil dibuat dan dikirim.`);

    } catch (error) {
        console.error('CASH_CODE_CONTROLLER: Error mengekspor kode cash pending ke Excel:', error);
        res.status(500).json({ success: false, message: 'Gagal mengekspor data kode cash pending.' });
    }
};



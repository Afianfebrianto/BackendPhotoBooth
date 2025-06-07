// backend-api/src/controllers/transactionController.js
const db = require('../db');
const ExcelJS = require('exceljs');

// Fungsi untuk memformat tanggal (bisa juga diletakkan di utils jika dipakai di banyak tempat)
function formatDateForDisplay(dateString) {
    if (!dateString) return '-';
    try {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    } catch (e) {
        return dateString; // Kembalikan string asli jika tidak valid
    }
}


// Mendapatkan Semua Transaksi (dengan filter bulan dan tahun)
exports.getAllTransactions = async (req, res) => {
    const { month, year } = req.query; // Ambil dari query string (e.g., /api/transactions?year=2024&month=6)
    console.log(`TRANSACTION_CONTROLLER: getAllTransactions dipanggil. Filter: Tahun=${year}, Bulan=${month}`);

    let query = `
        SELECT t.id, t.created_at, t.paid_at, t.payment_method, t.status, 
               t.electron_merchant_ref, t.tripay_reference, t.customer_name,
               t.base_amount, t.discount_applied, t.final_amount, 
               v.code as voucher_code_value, 
               cpc.code as cash_code_value,
               t.transaction_notes
        FROM transactions t
        LEFT JOIN vouchers v ON t.voucher_id = v.id
        LEFT JOIN cash_payment_codes cpc ON t.cash_payment_code_id = cpc.id
    `;
    const queryParams = [];
    let whereClauseAdded = false;

    if (year) {
        query += ` WHERE EXTRACT(YEAR FROM t.created_at) = $${queryParams.length + 1}`;
        queryParams.push(parseInt(year));
        whereClauseAdded = true;
    }
    if (month) {
        query += whereClauseAdded ? ` AND EXTRACT(MONTH FROM t.created_at) = $${queryParams.length + 1}` : ` WHERE EXTRACT(MONTH FROM t.created_at) = $${queryParams.length + 1}`;
        queryParams.push(parseInt(month));
    }

    query += ' ORDER BY t.created_at DESC';

    try {
        console.log("TRANSACTION_CONTROLLER: Query getAllTransactions:", query, "Params:", queryParams);
        const { rows } = await db.query(query, queryParams);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Error mendapatkan semua transaksi:', error);
        res.status(500).json({ success: false, message: 'Gagal mendapatkan data transaksi.' });
    }
};

// Export Transaksi ke Excel
exports.exportTransactionsToExcel = async (req, res) => {
    const { month, year } = req.query;
    console.log(`TRANSACTION_CONTROLLER: exportTransactionsToExcel dipanggil. Filter: Tahun=${year}, Bulan=${month}`);

    let query = `
        SELECT t.id, t.created_at, t.paid_at, t.payment_method, t.status, 
               t.electron_merchant_ref, t.tripay_reference, t.customer_name,
               t.base_amount, t.discount_applied, t.final_amount, 
               v.code as voucher_code_value, 
               cpc.code as cash_code_value,
               t.transaction_notes
        FROM transactions t
        LEFT JOIN vouchers v ON t.voucher_id = v.id
        LEFT JOIN cash_payment_codes cpc ON t.cash_payment_code_id = cpc.id
    `;
    const queryParams = [];
    let whereClauseAdded = false;

    if (year) {
        query += ` WHERE EXTRACT(YEAR FROM t.created_at) = $${queryParams.length + 1}`;
        queryParams.push(parseInt(year));
        whereClauseAdded = true;
    }
    if (month) {
        query += whereClauseAdded ? ` AND EXTRACT(MONTH FROM t.created_at) = $${queryParams.length + 1}` : ` WHERE EXTRACT(MONTH FROM t.created_at) = $${queryParams.length + 1}`;
        queryParams.push(parseInt(month));
    }
    query += ' ORDER BY t.created_at DESC';

    try {
        const { rows: transactions } = await db.query(query, queryParams);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Transaksi');

        // Definisikan header kolom
        worksheet.columns = [
            { header: 'ID Transaksi', key: 'id', width: 15 },
            { header: 'Tgl. Dibuat', key: 'created_at', width: 25 },
            { header: 'Tgl. Bayar', key: 'paid_at', width: 25 },
            { header: 'Metode', key: 'payment_method', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Ref. Internal', key: 'electron_merchant_ref', width: 25 },
            { header: 'Ref. Eksternal', key: 'tripay_reference', width: 25 },
            { header: 'Nama Pelanggan', key: 'customer_name', width: 25 },
            { header: 'Harga Asli (Rp)', key: 'base_amount', width: 20, style: { numFmt: '#,##0' } },
            { header: 'Diskon (Rp)', key: 'discount_applied', width: 15, style: { numFmt: '#,##0' } },
            { header: 'Total Bayar (Rp)', key: 'final_amount', width: 20, style: { numFmt: '#,##0' } },
            { header: 'Voucher Digunakan', key: 'voucher_code_value', width: 20 },
            { header: 'Kode Cash Digunakan', key: 'cash_code_value', width: 20 },
            { header: 'Catatan', key: 'transaction_notes', width: 30 }
        ];

        // Tambahkan gaya pada header
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' } // Warna abu-abu muda
        };


        // Tambahkan data baris
        transactions.forEach(tx => {
            worksheet.addRow({
                ...tx,
                created_at: tx.created_at ? formatDateForDisplay(tx.created_at) : '-', // Format tanggal
                paid_at: tx.paid_at ? formatDateForDisplay(tx.paid_at) : '-',
                base_amount: tx.base_amount ? parseFloat(tx.base_amount) : 0,
                discount_applied: tx.discount_applied ? parseFloat(tx.discount_applied) : 0,
                final_amount: tx.final_amount ? parseFloat(tx.final_amount) : 0,
            });
        });
        
        // Atur border untuk semua sel yang terisi
        worksheet.eachRow({ includeEmpty: false }, function(row, rowNumber) {
            row.eachCell({ includeEmpty: true }, function(cell, colNumber) {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });


        // Set header untuk respons download
        const filename = `Laporan_Transaksi_${year || 'SemuaTahun'}_${month || 'SemuaBulan'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        await workbook.xlsx.write(res);
        res.end();
        console.log(`TRANSACTION_CONTROLLER: File Excel ${filename} berhasil dibuat dan dikirim.`);

    } catch (error) {
        console.error('Error mengekspor transaksi ke Excel:', error);
        res.status(500).json({ success: false, message: 'Gagal mengekspor data transaksi.' });
    }
};


// Fungsi untuk mencatat transaksi QRIS (dipanggil oleh callback TriPay atau setelah polling sukses)
// Ini contoh, logika detailnya akan bergantung pada data dari TriPay
exports.recordQrisTransaction = async (tripayData, electronRef = null) => {
    // tripayData adalah objek yang berisi detail dari TriPay setelah pembayaran QRIS sukses
    // Misalnya: { reference, merchant_ref, amount, status, paid_at, customer_name, ... }
    // Kita asumsikan diskon dan voucher sudah dihandle saat pembuatan transaksi di TriPay
    
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Cek apakah transaksi dengan tripay_reference ini sudah ada untuk menghindari duplikasi
        const existingTx = await client.query('SELECT id FROM transactions WHERE tripay_reference = $1', [tripayData.reference]);
        if (existingTx.rows.length > 0) {
            console.log(`Transaksi dengan TriPay Ref ${tripayData.reference} sudah ada. ID: ${existingTx.rows[0].id}`);
            await client.query('ROLLBACK'); // Atau bisa juga update jika perlu
            return { success: true, message: "Transaksi sudah tercatat sebelumnya.", transactionId: existingTx.rows[0].id };
        }

        // Asumsi: base_amount dan discount_applied perlu dihitung atau diambil dari data pembuatan awal
        // Untuk QRIS, final_amount adalah amount dari TriPay
        // Jika voucher dipakai, kita perlu menyimpan voucher_id
        // Ini perlu logika lebih lanjut untuk mengambil detail voucher yang mungkin dipakai saat create QRIS
        
        const finalAmount = parseFloat(tripayData.amount);
        // Placeholder untuk base_amount dan discount, idealnya ini diketahui saat QRIS dibuat
        let baseAmount = finalAmount; 
        let discountApplied = 0;
        let voucherIdUsed = null;

        // Jika ada info voucher yang dipakai saat QRIS dibuat, kita bisa query ke DB
        // if (tripayData.applied_voucher_code) {
        //     const voucherRes = await client.query('SELECT id FROM vouchers WHERE code = $1', [tripayData.applied_voucher_code]);
        //     if (voucherRes.rows.length > 0) voucherIdUsed = voucherRes.rows[0].id;
        //     // Hitung ulang baseAmount jika perlu, atau simpan saja apa adanya
        // }


        const { rows } = await client.query(
            `INSERT INTO transactions (electron_merchant_ref, tripay_reference, payment_method, status, 
                                      base_amount, discount_applied, final_amount, voucher_id, 
                                      customer_name, customer_email, customer_phone, paid_at, transaction_notes)
             VALUES ($1, $2, 'QRIS', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id`,
            [
                electronRef || tripayData.merchant_ref, // merchant_ref dari TriPay bisa jadi electron_merchant_ref
                tripayData.reference,
                tripayData.status.toUpperCase(), // PAID, FAILED, EXPIRED
                baseAmount,
                discountApplied,
                finalAmount,
                voucherIdUsed,
                tripayData.customer_name,
                tripayData.customer_email,
                tripayData.customer_phone,
                tripayData.paid_at ? new Date(tripayData.paid_at * 1000) : new Date(), // Konversi Unix timestamp ke Date
                tripayData.note || null
            ]
        );
        await client.query('COMMIT');
        console.log(`Transaksi QRIS berhasil dicatat. ID: ${rows[0].id}, TriPay Ref: ${tripayData.reference}`);
        return { success: true, message: "Transaksi QRIS berhasil dicatat.", transactionId: rows[0].id };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error mencatat transaksi QRIS:', error);
        throw error; // Lemparkan error agar pemanggil tahu
    } finally {
        client.release();
    }
};

 // Fungsi untuk mencatat transaksi QRIS berdasarkan notifikasi dari Electron
    exports.notifyQrisPaidByElectron = async (req, res) => {
        const {
             tripay_reference,
        electron_merchant_ref,
        final_amount,       // Ini adalah amount setelah diskon
        base_amount,        // Ini adalah harga ASLI sebelum diskon
        discount_applied,   // Ini adalah jumlah diskonnya
        voucher_code_used,  // Kode voucher yang dipakai
        customer_name,
        customer_email,
        customer_phone,
        paid_at_timestamp,
        notes
        } = req.body;

        console.log("TRANSACTION_CONTROLLER: Menerima notifikasi QRIS PAID dari Electron:", JSON.stringify(req.body, null, 2));

        if (!tripay_reference || typeof final_amount === 'undefined') {
            return res.status(400).json({ success: false, message: 'Data tidak lengkap: tripay_reference dan final_amount diperlukan.' });
        }

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            // Cek apakah transaksi dengan tripay_reference ini sudah ada
            const existingTx = await client.query('SELECT id FROM transactions WHERE tripay_reference = $1', [tripay_reference]);
            if (existingTx.rows.length > 0) {
                console.log(`TRANSACTION_CONTROLLER: Transaksi QRIS (via Electron) dengan TriPay Ref ${tripay_reference} sudah ada. ID: ${existingTx.rows[0].id}.`);
                await client.query('ROLLBACK');
                // Kirim respons sukses karena sudah tercatat, atau error jika ini tidak diharapkan
                return res.status(200).json({ success: true, message: "Transaksi sudah tercatat sebelumnya.", transactionId: existingTx.rows[0].id });
            }

            let voucherId = null;
            if (voucher_code_used && voucher_code_used.trim() !== '') {
            const voucherRes = await client.query('SELECT id FROM vouchers WHERE UPPER(code) = UPPER($1)', [voucher_code_used]);
            if (voucherRes.rows.length > 0) {
                voucherId = voucherRes.rows[0].id;
            } else {
                console.warn(`TRANSACTION_CONTROLLER: Voucher code ${voucher_code_used} dari Electron tidak ditemukan di DB saat mencatat transaksi QRIS.`);
                // Pertimbangkan apakah ini error atau boleh lanjut tanpa voucher_id
            }
        }

        // --- LOGIKA BARU: UPDATE PENGGUNAAN VOUCHER ---
        if (voucherId) {
            console.log(`TRANSACTION_CONTROLLER: Menambah hitungan penggunaan untuk voucher ID: ${voucherId}`);
            await client.query(
                'UPDATE vouchers SET times_used = times_used + 1, updated_at = NOW() WHERE id = $1',
                [voucherId]
            );
        }
        // --- AKHIR LOGIKA BARU ---
            
            const actualBaseAmount = parseFloat(base_amount);
        const actualDiscountApplied = parseFloat(discount_applied) || 0;
        const actualFinalAmount = parseFloat(final_amount);
        const paidAtDate = paid_at_timestamp ? new Date(paid_at_timestamp * 1000) : new Date();


            const queryText = `
            INSERT INTO transactions 
            (electron_merchant_ref, tripay_reference, payment_method, status, 
             base_amount, discount_applied, final_amount, voucher_id, 
             customer_name, customer_email, customer_phone, paid_at, transaction_notes)
            VALUES ($1, $2, 'QRIS', 'PAID', $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id`;
        const queryValues = [
            electron_merchant_ref || `EL-${tripay_reference}`,
            tripay_reference,
            actualBaseAmount,       // Gunakan base_amount dari Electron
            actualDiscountApplied,  // Gunakan discount_applied dari Electron
            actualFinalAmount,      // Gunakan final_amount dari Electron
            voucherId,              // Gunakan voucherId yang sudah dicari
            customer_name || null,
            customer_email || null,
            customer_phone || null,
            paidAtDate,
            notes || null
        ];

            console.log("TRANSACTION_CONTROLLER: Query INSERT (Electron notify):", queryText);
            console.log("TRANSACTION_CONTROLLER: Values INSERT (Electron notify):", queryValues);
            
            const { rows } = await client.query(queryText, queryValues);
            
            await client.query('COMMIT');
            console.log(`TRANSACTION_CONTROLLER: Transaksi QRIS (via Electron) berhasil dicatat. ID DB: ${rows[0].id}, TriPay Ref: ${tripay_reference}`);
            res.status(201).json({ success: true, message: "Transaksi QRIS berhasil dicatat oleh server.", transactionId: rows[0].id });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('TRANSACTION_CONTROLLER: Error SQL saat mencatat transaksi QRIS dari Electron:', error);
            res.status(500).json({ success: false, message: 'Gagal mencatat transaksi di server.', error: error.message });
        } finally {
            client.release();
        }
    };



// Endpoint untuk callback dari TriPay (SANGAT PENTING DIAMANKAN)
exports.tripayCallbackHandler = async (req, res) => {
    const callbackData = req.body;
    console.log("Menerima callback dari TriPay:", JSON.stringify(callbackData, null, 2));

    // 1. Validasi Signature dari TriPay (SANGAT PENTING!)
    //    const privateKey = process.env.TRIPAY_PRIVATE_KEY;
    //    const signature = crypto.createHmac('sha256', privateKey)
    //                          .update(JSON.stringify(callbackData)) // Atau format lain sesuai dok TriPay
    //                          .digest('hex');
    //    if (signature !== req.headers['x-callback-signature']) { // Nama header bisa berbeda
    //        console.error("Callback TriPay: Signature tidak valid!");
    //        return res.status(400).json({ success: false, message: "Invalid signature" });
    //    }
    //    Untuk sekarang, kita skip validasi signature demi kesederhanaan, TAPI JANGAN LAKUKAN INI DI PRODUKSI.

    // 2. Proses data callback
    if (callbackData.status && (callbackData.status.toUpperCase() === 'PAID' || callbackData.status.toUpperCase() === 'SETTLED')) {
        try {
            // Panggil fungsi untuk mencatat/mengupdate transaksi berdasarkan callbackData
            await exports.recordQrisTransaction(callbackData); // Electron ref mungkin tidak ada di sini
            res.json({ success: true }); // Kirim respons OK ke TriPay
        } catch (error) {
            console.error("Error memproses callback TriPay PAID:", error);
            // Jangan kirim error detail ke TriPay, cukup status 500
            res.status(500).json({ success: false, message: "Internal server error" });
        }
    } else if (callbackData.status && (callbackData.status.toUpperCase() === 'EXPIRED' || callbackData.status.toUpperCase() === 'FAILED')) {
        // Handle status gagal atau kedaluwarsa jika perlu update di DB
        // Misalnya, update status transaksi yang sudah ada menjadi FAILED/EXPIRED
        console.log(`Callback TriPay: Status ${callbackData.status} untuk ref ${callbackData.reference}`);
        // TODO: Logika update status transaksi yang sudah ada
        res.json({ success: true }); // Tetap kirim OK ke TriPay
    } else {
        console.warn("Callback TriPay: Status tidak dikenal atau tidak relevan:", callbackData.status);
        res.json({ success: true }); // Tetap kirim OK
    }
};
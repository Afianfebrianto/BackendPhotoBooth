const db = require('../db'); // <-- TAMBAHKAN BARIS IMPOR INI
exports.getDashboardStats = async (req, res) => {
    console.log("DASHBOARD_CONTROLLER: getDashboardStats dipanggil.");
    try {
        // Jumlah Kode Cash Pending
        const pendingCodesResult = await db.query(
            "SELECT COUNT(*) as total_pending_codes, SUM(amount) as total_pending_value FROM cash_payment_codes WHERE status = 'PENDING'"
        );
        const pendingCodesStats = pendingCodesResult.rows[0];

        // Jumlah Voucher Aktif
        const activeVouchersResult = await db.query(
            "SELECT COUNT(*) as total_active_vouchers FROM vouchers WHERE is_active = TRUE"
        );
        const activeVouchersCount = activeVouchersResult.rows[0].total_active_vouchers;
        
        // Transaksi PAID Hari Ini
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // Awal hari ini
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1); // Awal hari berikutnya

        const paidTodayResult = await db.query(
            "SELECT COUNT(*) as count, SUM(final_amount) as total_revenue FROM transactions WHERE status = 'PAID' AND paid_at >= $1 AND paid_at < $2",
            [todayStart, todayEnd]
        );
        const paidTodayStats = paidTodayResult.rows[0];


        res.json({
            success: true,
            data: {
                pendingCashCodes: {
                    count: parseInt(pendingCodesStats.total_pending_codes || 0),
                    totalValue: parseFloat(pendingCodesStats.total_pending_value || 0)
                },
                activeVouchers: parseInt(activeVouchersCount || 0),
                transactionsToday: {
                    count: parseInt(paidTodayStats.count || 0),
                    totalRevenue: parseFloat(paidTodayStats.total_revenue || 0)
                }
                // Tambahkan statistik lain di sini
            }
        });
    } catch (error) {
        console.error('DASHBOARD_CONTROLLER: Error mendapatkan statistik dashboard:', error);
        res.status(500).json({ success: false, message: 'Gagal mendapatkan statistik dashboard.' });
    }
};

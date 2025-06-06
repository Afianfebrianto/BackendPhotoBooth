// backend-api/public/js/admin-dashboard.js

// Pastikan admin-auth.js sudah dimuat dan fungsi fetchWithAuth tersedia.
document.addEventListener('DOMContentLoaded', () => {
    console.log("ADMIN-DASHBOARD.JS: Document ready.");

    const statPendingCashCodesCount = document.getElementById('statPendingCashCodesCount');
    const statPendingCashCodesValue = document.getElementById('statPendingCashCodesValue');
    const statActiveVouchersCount = document.getElementById('statActiveVouchersCount');
    const statTransactionsTodayCount = document.getElementById('statTransactionsTodayCount');
    const statTransactionsTodayRevenue = document.getElementById('statTransactionsTodayRevenue');

    function formatCurrency(amount) {
        if (amount === null || typeof amount === 'undefined') return 'Rp 0';
        return 'Rp ' + parseFloat(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    async function loadDashboardStats() {
        console.log("ADMIN-DASHBOARD.JS: loadDashboardStats() dipanggil.");
        if (typeof fetchWithAuth !== 'function') {
            console.error("ADMIN-DASHBOARD.JS: Fungsi fetchWithAuth tidak terdefinisi!");
            // Tampilkan pesan error di UI jika perlu
            if(statPendingCashCodesCount) statPendingCashCodesCount.textContent = "Error";
            return;
        }

        try {
            const response = await fetchWithAuth('/api/dashboard/stats');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Gagal memuat statistik.' }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log("ADMIN-DASHBOARD.JS: Statistik diterima:", result);

            if (result.success && result.data) {
                const stats = result.data;
                if (statPendingCashCodesCount) statPendingCashCodesCount.textContent = stats.pendingCashCodes?.count || 0;
                if (statPendingCashCodesValue) statPendingCashCodesValue.textContent = formatCurrency(stats.pendingCashCodes?.totalValue);
                
                if (statActiveVouchersCount) statActiveVouchersCount.textContent = stats.activeVouchers || 0;
                
                if (statTransactionsTodayCount) statTransactionsTodayCount.textContent = stats.transactionsToday?.count || 0;
                if (statTransactionsTodayRevenue) statTransactionsTodayRevenue.textContent = formatCurrency(stats.transactionsToday?.totalRevenue);
            } else {
                console.warn("ADMIN-DASHBOARD.JS: Gagal memuat statistik atau format data salah:", result.message);
                if(statPendingCashCodesCount) statPendingCashCodesCount.textContent = "N/A";
            }
        } catch (error) {
            console.error('ADMIN-DASHBOARD.JS: Error saat loadDashboardStats:', error);
            if(statPendingCashCodesCount) statPendingCashCodesCount.textContent = "Error";
            // Tampilkan pesan error lebih detail di UI jika perlu
        }
    }

    // Muat statistik saat halaman siap
    loadDashboardStats();
});
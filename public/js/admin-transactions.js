// backend-api/public/js/admin-transactions.js

$(document).ready(function() {
    console.log("ADMIN-TRANSACTIONS.JS: Document ready, skrip dimulai.");
    let transactionsTable;
    let currentYearFilter = "";  // Menyimpan filter tahun yang sedang aktif
    let currentMonthFilter = ""; // Menyimpan filter bulan yang sedang aktif

    // Fungsi untuk memformat tanggal ke format yang lebih mudah dibaca
    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
            return new Date(dateString).toLocaleDateString('id-ID', options);
        } catch (e) {
            console.warn("ADMIN-TRANSACTIONS.JS: Gagal format tanggal:", dateString, e);
            return dateString; // Kembalikan string asli jika tidak valid
        }
    }

    // Fungsi untuk memformat angka menjadi format mata uang Rupiah
    function formatCurrency(amount) {
        if (amount === null || typeof amount === 'undefined') return '-';
        return 'Rp ' + parseFloat(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    // Fungsi untuk memuat ulang dan merender tabel transaksi
    async function loadTransactions(filters = {}) {
        console.log("ADMIN-TRANSACTIONS.JS: loadTransactions() dipanggil dengan filter:", filters);
        const tbody = $('#transactionsTable tbody');
        const tfootTh = $('#totalRevenuePaid');
        tbody.html('<tr><td colspan="14" class="text-center">Memuat data transaksi... <i class="fas fa-spinner fa-spin"></i></td></tr>');
        tfootTh.text('Menghitung...');
        
        // Simpan filter yang sedang digunakan untuk keperluan export
        currentYearFilter = filters.year || "";
        currentMonthFilter = filters.month || "";

        let apiUrl = '/api/transactions';
        const queryParams = new URLSearchParams();
        if (filters.year) queryParams.append('year', filters.year);
        if (filters.month) queryParams.append('month', filters.month);
        
        const queryString = queryParams.toString();
        if (queryString) {
            apiUrl += `?${queryString}`;
        }
        console.log("ADMIN-TRANSACTIONS.JS: API URL yang akan dipanggil:", apiUrl);

        try {
            // Pastikan fetchWithAuth sudah terdefinisi (dari admin-auth.js)
            if (typeof fetchWithAuth !== 'function') {
                console.error("ADMIN-TRANSACTIONS.JS: Fungsi fetchWithAuth tidak terdefinisi!");
                tbody.html('<tr><td colspan="14" class="text-center">Error Kritis: Fungsi otentikasi tidak ditemukan.</td></tr>');
                tfootTh.text('Error');
                return;
            }

            const response = await fetchWithAuth(apiUrl); // Menggunakan GET default
            console.log("ADMIN-TRANSACTIONS.JS: Fetch ke /api/transactions selesai. Status:", response.status);
            
            if (!response.ok) {
                let errorData = { message: `Gagal memuat data transaksi (HTTP status: ${response.status})` };
                try { 
                    errorData = await response.json(); 
                    console.log("ADMIN-TRANSACTIONS.JS: Error data dari server:", errorData);
                } catch (e) { 
                    console.log("ADMIN-TRANSACTIONS.JS: Respons error bukan JSON, atau parsing gagal.");
                    const errorText = await response.text(); // Coba ambil teksnya
                    errorData.message = errorText || errorData.message;
                }
                throw new Error(errorData.message);
            }

            const result = await response.json();
            console.log("ADMIN-TRANSACTIONS.JS: Data transaksi diterima dari server (setelah .json()):", result);

            if (result.success && Array.isArray(result.data)) {
                console.log("ADMIN-TRANSACTIONS.JS: Data sukses dan merupakan array. Memanggil populateTransactionsTable.");
                populateTransactionsTable(result.data);
            } else {
                console.warn("ADMIN-TRANSACTIONS.JS: Gagal memuat data atau format tidak sesuai:", result.message || 'Format data dari server tidak sesuai.');
                tbody.html('<tr><td colspan="14" class="text-center">Gagal memuat data: ' + (result.message || 'Format data dari server tidak sesuai.') + '</td></tr>');
                tfootTh.text('Error');
            }
        } catch (error) {
            console.error('ADMIN-TRANSACTIONS.JS: Error besar saat loadTransactions:', error);
            tbody.html('<tr><td colspan="14" class="text-center">Error: ' + error.message + '</td></tr>');
            tfootTh.text('Error');
        }
    }

    // Fungsi untuk mengisi tabel dengan data transaksi
    function populateTransactionsTable(transactions) {
        console.log("ADMIN-TRANSACTIONS.JS: populateTransactionsTable() dipanggil dengan", transactions.length, "item.");
        if (transactionsTable) {
            console.log("ADMIN-TRANSACTIONS.JS: Menghancurkan instance DataTables lama.");
            transactionsTable.destroy();
        }
        const tbody = $('#transactionsTable tbody');
        tbody.empty(); // Kosongkan isi tabel sebelumnya

        let totalPaidRevenue = 0;

        if (transactions.length === 0) {
            console.log("ADMIN-TRANSACTIONS.JS: Tidak ada transaksi untuk ditampilkan.");
            // Biarkan DataTables yang menampilkan pesan "emptyTable" jika tabel sudah diinisialisasi
        } else {
            transactions.forEach(tx => {
                // Hitung total pemasukan hanya dari transaksi yang PAID
                if (tx.status === 'PAID' && tx.final_amount != null) { // Periksa null juga
                    totalPaidRevenue += parseFloat(tx.final_amount);
                }

                let statusBadge = tx.status;
                switch (tx.status) {
                    case 'PAID': statusBadge = '<span class="badge badge-success">LUNAS</span>'; break;
                    case 'UNPAID': statusBadge = '<span class="badge badge-warning">BELUM BAYAR</span>'; break;
                    case 'PENDING_CASH_CODE': statusBadge = '<span class="badge badge-info">KODE CASH PENDING</span>'; break;
                    case 'FAILED': statusBadge = '<span class="badge badge-danger">GAGAL</span>'; break;
                    case 'EXPIRED': statusBadge = '<span class="badge badge-secondary">KADALUWARSA</span>'; break;
                    case 'CANCELLED': statusBadge = '<span class="badge badge-dark">DIBATALKAN</span>'; break;
                    default: statusBadge = `<span class="badge badge-light">${tx.status || 'N/A'}</span>`; break;
                }

                tbody.append(`
                    <tr>
                        <td>${tx.id}</td>
                        <td>${formatDate(tx.created_at)}</td>
                        <td>${tx.paid_at ? formatDate(tx.paid_at) : '-'}</td>
                        <td>${tx.payment_method || '-'}</td>
                        <td>${statusBadge}</td>
                        <td>${tx.electron_merchant_ref || '-'}</td>
                        <td>${tx.tripay_reference || '-'}</td>
                        <td>${tx.customer_name || '-'}</td>
                        <td class="text-right">${formatCurrency(tx.base_amount)}</td>
                        <td class="text-right">${formatCurrency(tx.discount_applied)}</td>
                        <td class="text-right font-weight-bold">${formatCurrency(tx.final_amount)}</td>
                        <td>${tx.voucher_code_value || (tx.voucher_id ? `ID: ${tx.voucher_id}`: '-')}</td>
                        <td>${tx.cash_code_value || (tx.cash_payment_code_id ? `ID: ${tx.cash_payment_code_id}`: '-')}</td>
                        <td>${tx.transaction_notes || '-'}</td>
                    </tr>
                `);
            });
        }
        
        // Update total revenue di footer tabel
        $('#totalRevenuePaid').text(formatCurrency(totalPaidRevenue));
        console.log("ADMIN-TRANSACTIONS.JS: Total Pemasukan (LUNAS) dihitung:", totalPaidRevenue);

        console.log("ADMIN-TRANSACTIONS.JS: Menginisialisasi DataTables.");
        transactionsTable = $('#transactionsTable').DataTable({
            "language": {
                "url": "//cdn.datatables.net/plug-ins/1.10.21/i18n/Indonesian.json",
                "emptyTable": "Belum ada data transaksi." // Pesan untuk tabel kosong
            },
            "destroy": true, // Izinkan menghancurkan dan membuat ulang tabel
            "order": [[1, "desc"]], // Urutkan berdasarkan Tgl. Dibuat (kolom kedua, index 1) secara descending
            "columnDefs": [ // Contoh untuk format kolom jika diperlukan untuk sorting angka
                { "type": "num-fmt", "targets": [8, 9, 10] } // Kolom Harga Asli, Diskon, Total Bayar
            ]
        });
        console.log("ADMIN-TRANSACTIONS.JS: DataTables diinisialisasi.");
    }

    // Event listener untuk form filter
    $('#filterTransactionsForm').on('submit', function(event) {
        event.preventDefault();
        const year = $('#filterYear').val();
        const month = $('#filterMonth').val();
        console.log(`ADMIN-TRANSACTIONS.JS: Filter disubmit. Tahun: ${year}, Bulan: ${month}`);
        loadTransactions({ year, month });
    });

    // Event listener untuk tombol reset filter
    $('#resetFilterButton').on('click', function() {
        console.log("ADMIN-TRANSACTIONS.JS: Tombol Reset Filter diklik.");
        $('#filterYear').val('');
        $('#filterMonth').val('');
        currentYearFilter = ""; // Reset filter global yang disimpan
        currentMonthFilter = "";
        loadTransactions(); // Muat semua transaksi (tanpa filter)
    });

    // Event listener untuk tombol export Excel
    $('#exportExcelButton').on('click', function() {
        console.log("ADMIN-TRANSACTIONS.JS: Tombol Export Excel diklik.");
        let exportUrl = '/api/transactions/export';
        const queryParams = new URLSearchParams();
        // Gunakan filter yang sedang aktif (disimpan di currentYearFilter dan currentMonthFilter)
        if (currentYearFilter) queryParams.append('year', currentYearFilter);
        if (currentMonthFilter) queryParams.append('month', currentMonthFilter);
        
        const queryString = queryParams.toString();
        if (queryString) {
            exportUrl += `?${queryString}`;
        }
        console.log("ADMIN-TRANSACTIONS.JS: URL Export yang akan dipanggil:", exportUrl);
        
        // Menggunakan fetchWithAuth untuk menyertakan token otentikasi
        fetchWithAuth(exportUrl, {
            method: 'GET',
            // Tidak perlu body untuk GET
        })
        .then(async response => {
            if (!response.ok) {
                let errorData = { message: 'Gagal mengunduh laporan.' };
                try { errorData = await response.json(); } catch (e) { /* abaikan jika bukan JSON */ }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            // Dapatkan nama file dari header Content-Disposition jika ada
            const disposition = response.headers.get('content-disposition');
            let filename = `laporan_transaksi_${currentYearFilter || 'SemuaTahun'}_${currentMonthFilter || 'SemuaBulan'}.xlsx`; // Nama file default
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) { 
                    filename = matches[1].replace(/['"]/g, '');
                }
            }
            return response.blob().then(blob => ({ blob, filename }));
        })
        .then(({ blob, filename }) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            console.log("ADMIN-TRANSACTIONS.JS: File Excel seharusnya sudah mulai diunduh:", filename);
        })
        .catch(error => {
            console.error('ADMIN-TRANSACTIONS.JS: Error saat export Excel:', error);
            alert('Gagal mengunduh laporan: ' + error.message);
        });
    });

    // Muat data transaksi awal saat halaman siap
    console.log("ADMIN-TRANSACTIONS.JS: Memanggil loadTransactions() untuk pertama kali.");
    loadTransactions();
});

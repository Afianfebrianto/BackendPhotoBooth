// backend-api/public/js/admin-pending-cash-codes.js

// Pastikan admin-auth.js sudah dimuat dan fungsi fetchWithAuth tersedia.
$(document).ready(function() {
    console.log("ADMIN-PENDING-CASH-CODES.JS: Document ready.");
    let pendingCashCodesTable;

    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            return new Date(dateString).toLocaleDateString('id-ID', options);
        } catch (e) { return dateString; }
    }

    function formatCurrency(amount) {
        if (amount === null || typeof amount === 'undefined') return '-';
        return 'Rp ' + parseFloat(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    async function loadPendingCashCodes() {
        console.log("ADMIN-PENDING-CASH-CODES.JS: loadPendingCashCodes() dipanggil.");
        const tbody = $('#pendingCashCodesTable tbody');
        tbody.html('<tr><td colspan="10" class="text-center">Memuat data... <i class="fas fa-spinner fa-spin"></i></td></tr>');
        
        try {
            if (typeof fetchWithAuth !== 'function') {
                throw new Error("Fungsi otentikasi (fetchWithAuth) tidak ditemukan.");
            }

            const response = await fetchWithAuth('/api/cash-codes/pending');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Gagal memuat data.'}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                populatePendingCashCodesTable(result.data);
            } else {
                tbody.html('<tr><td colspan="10" class="text-center">Gagal memuat data: ' + (result.message || 'Format tidak sesuai.') + '</td></tr>');
            }
        } catch (error) {
            console.error('ADMIN-PENDING-CASH-CODES.JS: Error loading pending cash codes:', error);
            tbody.html('<tr><td colspan="10" class="text-center">Error: ' + error.message + '</td></tr>');
        }
    }

    function populatePendingCashCodesTable(codes) {
        console.log("ADMIN-PENDING-CASH-CODES.JS: populatePendingCashCodesTable() dengan", codes.length, "item.");
        if (pendingCashCodesTable) {
            pendingCashCodesTable.destroy();
        }
        const tbody = $('#pendingCashCodesTable tbody');
        tbody.empty();

        if (codes.length === 0) {
            // Biarkan DataTables yang menampilkan pesan "emptyTable"
        } else {
            codes.forEach(code => {
                tbody.append(`
                    <tr>
                        <td>${code.id}</td>
                        <td><strong>${code.code}</strong></td>
                        <td class="text-right">${formatCurrency(code.base_amount)}</td>
                        <td class="text-right">${formatCurrency(code.discount_applied)}</td>
                        <td class="text-right font-weight-bold">${formatCurrency(code.amount)}</td>
                        <td>${code.voucher_code_used || '-'}</td>
                        <td>${code.created_by_username || 'N/A'}</td>
                        <td>${formatDate(code.created_at)}</td>
                        <td>${code.expires_at ? formatDate(code.expires_at) : 'Tidak Terbatas'}</td>
                        <td>
                            <button class="btn btn-sm btn-danger btn-cancel-code" data-id="${code.id}" title="Batalkan Kode">
                                <i class="fas fa-times-circle"></i> Batalkan
                            </button>
                        </td>
                    </tr>
                `);
            });
        }
        
        pendingCashCodesTable = $('#pendingCashCodesTable').DataTable({
            "language": {
                "url": "//cdn.datatables.net/plug-ins/1.10.21/i18n/Indonesian.json",
                "emptyTable": "Tidak ada kode cash yang belum terpakai."
            },
            "destroy": true,
            "order": [[7, "desc"]] // Urutkan berdasarkan Tgl. Dibuat descending
        });
    }

    // Handle klik tombol Batalkan Kode (CONTOH - Perlu endpoint API DELETE atau PUT untuk update status)
    $('#pendingCashCodesTable tbody').on('click', '.btn-cancel-code', async function() {
        const codeId = $(this).data('id');
        const codeValue = $(this).closest('tr').find('td:nth-child(2)').text(); // Ambil kode dari tabel
        console.log(`ADMIN-PENDING-CASH-CODES.JS: Tombol Batalkan Kode diklik untuk ID: ${codeId}, Kode: ${codeValue}`);

        if (confirm(`Anda yakin ingin membatalkan kode cash "${codeValue}" (ID: ${codeId})? Kode ini tidak akan bisa digunakan lagi.`)) {
            try {
                // Kamu perlu membuat endpoint API PUT /api/cash-codes/:id/cancel atau sejenisnya
                // Untuk sekarang, kita hanya tampilkan alert dan muat ulang
                // const response = await fetchWithAuth(`/api/cash-codes/${codeId}/cancel`, { method: 'PUT' });
                // const result = await response.json();
                // if (result.success) {
                //     alert(`Kode cash "${codeValue}" berhasil dibatalkan.`);
                //     loadPendingCashCodes();
                // } else {
                //     alert('Gagal membatalkan kode: ' + (result.message || 'Error server.'));
                // }
                alert(`Fungsionalitas pembatalan kode untuk ID ${codeId} belum diimplementasikan di backend.`);
                // loadPendingCashCodes(); // Muat ulang untuk sementara
            } catch (error) {
                console.error("ADMIN-PENDING-CASH-CODES.JS: Error saat membatalkan kode:", error);
                alert('Error: ' + error.message);
            }
        }
    });

     // Event listener BARU untuk tombol Export Excel
    $('#exportPendingCashCodesButton').on('click', function() {
        console.log("ADMIN-PENDING-CASH-CODES.JS: Tombol Export Excel diklik.");
        const exportUrl = '/api/cash-codes/pending/export'; // Tidak perlu filter untuk pending codes
        
        console.log("ADMIN-PENDING-CASH-CODES.JS: URL Export:", exportUrl);

        // Menggunakan fetchWithAuth untuk menyertakan token otentikasi
        // dan membiarkan browser menangani download
        fetchWithAuth(exportUrl, { method: 'GET' })
        .then(async response => {
            if (!response.ok) {
                let errorData = { message: 'Gagal mengunduh laporan kode cash pending.' };
                try { errorData = await response.json(); } catch (e) { /* ignore */ }
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            // Dapatkan nama file dari header Content-Disposition jika ada
            const disposition = response.headers.get('content-disposition');
            let filename = `laporan_kode_cash_pending.xlsx`; // Nama file default
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
            a.download = filename; // Gunakan nama file dari server atau default
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            console.log("ADMIN-PENDING-CASH-CODES.JS: File Excel seharusnya sudah mulai diunduh:", filename);
        })
        .catch(error => {
            console.error('ADMIN-PENDING-CASH-CODES.JS: Error saat export Excel kode cash pending:', error);
            alert('Gagal mengunduh laporan: ' + error.message);
        });
    });


    // Muat data awal
    loadPendingCashCodes();
});

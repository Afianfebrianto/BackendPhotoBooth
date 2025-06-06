// backend-api/public/js/admin-vouchers.js

$(document).ready(function() {
    console.log("ADMIN-VOUCHERS.JS: Document ready, skrip dimulai.");
    let vouchersTable;
    let allFetchedVouchers = []; // Untuk menyimpan data voucher yang sudah di-fetch

    // Fungsi untuk memuat ulang dan merender tabel voucher
    async function loadVouchers() {
        console.log("ADMIN-VOUCHERS.JS: loadVouchers() dipanggil.");
        // Tampilkan pesan loading di tabel
        const tbody = $('#vouchersTable tbody');
        tbody.html('<tr><td colspan="9" class="text-center">Memuat data voucher... <i class="fas fa-spinner fa-spin"></i></td></tr>');
        
        try {
            // Pastikan fetchWithAuth sudah terdefinisi dan berfungsi dengan benar (dari admin-auth.js)
            if (typeof fetchWithAuth !== 'function') {
                console.error("ADMIN-VOUCHERS.JS: Fungsi fetchWithAuth tidak terdefinisi!");
                tbody.html('<tr><td colspan="9" class="text-center">Error: Fungsi otentikasi tidak ditemukan.</td></tr>');
                return;
            }

            const response = await fetchWithAuth('/api/vouchers'); // Menggunakan GET default
            
            if (!response.ok) {
                let errorData = { message: 'Gagal memuat data voucher (status tidak OK).' };
                try {
                    errorData = await response.json();
                } catch (e) {
                    // Biarkan errorData default jika respons bukan JSON
                }
                console.error("ADMIN-VOUCHERS.JS: Error response dari /api/vouchers", response.status, errorData);
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log("ADMIN-VOUCHERS.JS: Data voucher diterima dari server:", result);

            if (result.success && Array.isArray(result.data)) {
                allFetchedVouchers = result.data; // Simpan data untuk referensi edit
                populateVouchersTable(allFetchedVouchers);
            } else {
                tbody.html('<tr><td colspan="9" class="text-center">Gagal memuat data: ' + (result.message || 'Format data dari server tidak sesuai.') + '</td></tr>');
            }
        } catch (error) {
            console.error('ADMIN-VOUCHERS.JS: Error saat loadVouchers:', error);
            tbody.html('<tr><td colspan="9" class="text-center">Error: ' + error.message + '</td></tr>');
        }
    }

    // Fungsi untuk mengisi tabel dengan data voucher
    function populateVouchersTable(vouchers) {
        console.log("ADMIN-VOUCHERS.JS: populateVouchersTable() dipanggil dengan", vouchers.length, "item.");
        if (vouchersTable) {
            vouchersTable.destroy(); // Hancurkan instance DataTable lama jika ada
        }
        const tbody = $('#vouchersTable tbody');
        tbody.empty(); // Kosongkan isi tabel sebelumnya

        if (vouchers.length === 0) {
            // Biarkan DataTables yang menampilkan pesan "emptyTable" jika tabel sudah diinisialisasi
            // Jika belum, atau ingin pesan kustom:
            // tbody.html('<tr><td colspan="9" class="text-center">Belum ada voucher. Silakan tambahkan voucher baru.</td></tr>');
        } else {
            vouchers.forEach(voucher => {
                const expiryDate = voucher.expiry_date ? new Date(voucher.expiry_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
                const isActive = voucher.is_active ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-danger">Tidak Aktif</span>';
                const maxDiscount = voucher.max_discount ? 'Rp ' + parseFloat(voucher.max_discount).toLocaleString('id-ID') : '-';
                const minPurchase = voucher.min_purchase ? 'Rp ' + parseFloat(voucher.min_purchase).toLocaleString('id-ID') : '-';
                const valueDisplay = voucher.type === 'percentage' ? (parseFloat(voucher.value) * 100).toFixed(0) + '%' : 'Rp ' + parseFloat(voucher.value).toLocaleString('id-ID');

                tbody.append(`
                    <tr data-voucher-id="${voucher.id}">
                        <td>${voucher.code}</td>
                        <td>${voucher.description || '-'}</td>
                        <td>${voucher.type}</td>
                        <td>${valueDisplay}</td>
                        <td>${minPurchase}</td>
                        <td>${maxDiscount}</td>
                        <td>${expiryDate}</td>
                        <td>${isActive}</td>
                        <td>
                            <button class="btn btn-sm btn-info btn-edit" data-id="${voucher.id}" title="Edit Voucher" data-toggle="modal" data-target="#addVoucherModal"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm btn-warning btn-toggle-active" data-id="${voucher.id}" data-active="${voucher.is_active}" title="${voucher.is_active ? 'Nonaktifkan' : 'Aktifkan'}">
                                <i class="fas ${voucher.is_active ? 'fa-toggle-off' : 'fa-toggle-on'}"></i>
                            </button>
                        </td>
                    </tr>
                `);
            });
        }
        // Inisialisasi DataTables setelah tabel diisi atau dikosongkan
        vouchersTable = $('#vouchersTable').DataTable({
            "language": {
                "url": "//cdn.datatables.net/plug-ins/1.10.21/i18n/Indonesian.json",
                "emptyTable": "Belum ada data voucher." // Pesan untuk tabel kosong
            },
            "destroy": true, // Izinkan menghancurkan dan membuat ulang tabel
            "order": [[0, "asc"]] // Contoh: Urutkan berdasarkan kolom pertama (Kode) secara ascending
        });
    }

    // Handle submit form tambah/edit voucher
    const voucherForm = document.getElementById('voucherForm');
    if (voucherForm) {
        console.log("ADMIN-VOUCHERS.JS: Form #voucherForm ditemukan. Memasang submit listener.");
        voucherForm.addEventListener('submit', async function(event) {
            event.preventDefault(); 
            console.log("ADMIN-VOUCHERS.JS: #voucherForm submitted via JavaScript.");

            const voucherId = document.getElementById('voucherId').value;
            const formData = {
                code: document.getElementById('voucherCode').value.toUpperCase().trim(),
                description: document.getElementById('voucherDescription').value.trim(),
                type: document.getElementById('voucherType').value,
                value: parseFloat(document.getElementById('voucherValue').value),
                min_purchase: parseFloat(document.getElementById('voucherMinPurchase').value) || 0,
                max_discount: document.getElementById('voucherMaxDiscount').value ? parseFloat(document.getElementById('voucherMaxDiscount').value) : null,
                expiry_date: document.getElementById('voucherExpiryDate').value || null,
                usage_limit: document.getElementById('voucherUsageLimit').value ? parseInt(document.getElementById('voucherUsageLimit').value, 10) : null,
                is_active: document.getElementById('voucherIsActive').value === 'true'
            };
            
            const voucherFormError = document.getElementById('voucherFormError');
            voucherFormError.style.display = 'none'; 
            voucherFormError.textContent = '';

            if (!formData.code && !voucherId) { // Kode wajib untuk voucher baru
                voucherFormError.textContent = 'Kode voucher tidak boleh kosong.';
                voucherFormError.style.display = 'block';
                return;
            }
            if (formData.type === 'percentage' && (isNaN(formData.value) || formData.value < 0 || formData.value > 1)) {
                voucherFormError.textContent = 'Untuk tipe persentase, nilai harus antara 0 (misal 0.0) dan 1 (misal 1.0 untuk 100%).';
                voucherFormError.style.display = 'block';
                return;
            }
            if (formData.type === 'fixed' && (isNaN(formData.value) || formData.value < 0)) {
                voucherFormError.textContent = 'Nilai voucher fixed tidak boleh negatif.';
                voucherFormError.style.display = 'block';
                return;
            }
            if (formData.expiry_date === "") formData.expiry_date = null;
            if (document.getElementById('voucherMaxDiscount').value === "") formData.max_discount = null;
            if (document.getElementById('voucherUsageLimit').value === "") formData.usage_limit = null;
            
            // Untuk mode edit, kita tidak mengirim 'code' jika tidak ingin bisa diubah
            if (voucherId) {
                delete formData.code; 
            }

            const url = voucherId ? `/api/vouchers/${voucherId}` : '/api/vouchers';
            const method = voucherId ? 'PUT' : 'POST';

            console.log(`ADMIN-VOUCHERS.JS: Mengirim ${method} request ke ${url} dengan data:`, JSON.stringify(formData));

            try {
                if (typeof fetchWithAuth !== 'function') {
                    console.error("ADMIN-VOUCHERS.JS: Fungsi fetchWithAuth tidak terdefinisi saat submit!");
                    voucherFormError.textContent = 'Error: Fungsi otentikasi tidak ditemukan.';
                    voucherFormError.style.display = 'block';
                    return;
                }
                const response = await fetchWithAuth(url, {
                    method: method,
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                console.log("ADMIN-VOUCHERS.JS: Respons dari server:", result);

                if (result.success) {
                    $('#addVoucherModal').modal('hide'); // Menggunakan jQuery untuk modal Bootstrap
                    loadVouchers(); // Muat ulang data tabel
                    alert(result.message || (voucherId ? 'Voucher berhasil diupdate!' : 'Voucher berhasil ditambahkan!'));
                } else {
                    voucherFormError.textContent = result.message || 'Gagal menyimpan voucher.';
                    voucherFormError.style.display = 'block';
                }
            } catch (error) {
                console.error('ADMIN-VOUCHERS.JS: Error saat menyimpan voucher:', error);
                let errorMessage = 'Terjadi kesalahan';
                if (error && error.message) { 
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                }
                voucherFormError.textContent = errorMessage;
                voucherFormError.style.display = 'block';
            }
        });
    } else {
        console.warn("ADMIN-VOUCHERS.JS: Form dengan ID #voucherForm tidak ditemukan.");
    }

    // Fungsi untuk mengisi form edit
    function populateEditForm(voucherData) {
        console.log("ADMIN-VOUCHERS.JS: populateEditForm() dipanggil dengan data:", voucherData);
        if (voucherData) {
            $('#voucherId').val(voucherData.id);
            $('#voucherCode').val(voucherData.code).prop('readonly', true); // Kode tidak bisa diedit
            $('#voucherDescription').val(voucherData.description || '');
            $('#voucherType').val(voucherData.type);
            $('#voucherValue').val(voucherData.value);
            $('#voucherMinPurchase').val(voucherData.min_purchase || 0);
            $('#voucherMaxDiscount').val(voucherData.max_discount === null || typeof voucherData.max_discount === 'undefined' ? '' : voucherData.max_discount);
            $('#voucherExpiryDate').val(voucherData.expiry_date ? voucherData.expiry_date.split('T')[0] : ''); // Format YYYY-MM-DD
            $('#voucherUsageLimit').val(voucherData.usage_limit === null || typeof voucherData.usage_limit === 'undefined' ? '' : voucherData.usage_limit);
            $('#voucherIsActive').val(voucherData.is_active.toString()); // Konversi boolean ke string "true" atau "false"
            
            $('#voucherModalLabel').text('Edit Voucher');
            // Tidak perlu $('#addVoucherModal').modal('show'); di sini, karena modal sudah dibuka oleh tombol edit atau event 'show.bs.modal'
        } else {
            console.warn("ADMIN-VOUCHERS.JS: Data voucher tidak valid untuk populateEditForm.");
        }
    }

    // Saat modal akan ditampilkan (event 'show.bs.modal')
    $('#addVoucherModal').on('show.bs.modal', function (event) {
        console.log("ADMIN-VOUCHERS.JS: Modal #addVoucherModal event show.bs.modal.");
        var button = $(event.relatedTarget); // Tombol yang memicu modal
        var voucherIdFromButton = button.data('id'); // Ambil ID dari data-id tombol

        $('#voucherForm')[0].reset(); // Selalu reset form dulu
        $('#voucherFormError').hide().text(''); // Sembunyikan pesan error lama

        if (voucherIdFromButton && button.hasClass('btn-edit')) { // Jika dipicu oleh tombol edit dan ada ID
            console.log("ADMIN-VOUCHERS.JS: Modal dibuka untuk mode EDIT, ID:", voucherIdFromButton);
            // Ambil data voucher dari allFetchedVouchers dan isi form
            const voucherToEdit = allFetchedVouchers.find(v => v.id == voucherIdFromButton); // Gunakan == karena data-id bisa jadi string
            if (voucherToEdit) {
                populateEditForm(voucherToEdit); // Panggil fungsi untuk mengisi form
            } else {
                console.error("ADMIN-VOUCHERS.JS: Tidak bisa menemukan data voucher untuk ID:", voucherIdFromButton, "di allFetchedVouchers.");
                $('#voucherModalLabel').text('Error Memuat Data');
                $('#voucherFormError').text('Gagal memuat data voucher untuk diedit. Muat ulang halaman dan coba lagi.').show();
                // Pertimbangkan untuk menonaktifkan tombol simpan atau menutup modal jika data tidak ditemukan
                // $('#saveVoucherButton').prop('disabled', true); 
            }
        } else { // Jika bukan dari tombol edit (misalnya tombol "Tambah Voucher Baru" utama)
            console.log("ADMIN-VOUCHERS.JS: Modal dibuka untuk mode TAMBAH BARU.");
            $('#voucherId').val(''); // Pastikan ID voucher kosong untuk mode tambah
            $('#voucherModalLabel').text('Tambah Voucher Baru');
            $('#voucherCode').prop('readonly', false); // Kode bisa diedit saat tambah
            // $('#saveVoucherButton').prop('disabled', false); // Pastikan tombol simpan aktif
        }
    });

    // Handle klik tombol Edit di tabel
    // Tombol edit di tabel sudah memiliki data-toggle="modal" dan data-target="#addVoucherModal"
    // jadi event 'show.bs.modal' di atas yang akan menangani pengisian form.
    // Kita bisa tambahkan listener klik ini hanya untuk logging jika perlu.
    $('#vouchersTable tbody').on('click', '.btn-edit', function() {
        console.log("ADMIN-VOUCHERS.JS: Tombol Edit diklik untuk ID:", $(this).data('id'), ". Modal akan terbuka oleh atribut data-toggle.");
    });

    // Handle klik tombol Toggle Aktif/Nonaktif
    $('#vouchersTable tbody').on('click', '.btn-toggle-active', async function() {
        const voucherId = $(this).data('id');
        const currentIsActive = $(this).data('active'); // Ini boolean dari server
        console.log(`ADMIN-VOUCHERS.JS: Tombol Toggle Active diklik untuk ID: ${voucherId}, Status saat ini: ${currentIsActive}`);
        const newStatus = !currentIsActive;
        const actionText = newStatus ? "mengaktifkan" : "menonaktifkan";

        if (confirm(`Anda yakin ingin ${actionText} voucher ini?`)) {
            try {
                if (typeof fetchWithAuth !== 'function') {
                    console.error("ADMIN-VOUCHERS.JS: Fungsi fetchWithAuth tidak terdefinisi saat toggle active!");
                    alert('Error: Fungsi otentikasi tidak ditemukan.');
                    return;
                }
                const response = await fetchWithAuth(`/api/vouchers/${voucherId}`, {
                    method: 'PUT',
                    body: JSON.stringify({ is_active: newStatus }) // Hanya kirim field yang diubah
                });
                const result = await response.json();
                if (result.success) {
                    alert(`Voucher berhasil di${actionText}!`);
                    loadVouchers(); // Muat ulang untuk menampilkan status baru
                } else {
                    alert('Gagal: ' + (result.message || `Gagal ${actionText} voucher.`));
                }
            } catch (error) {
                console.error("ADMIN-VOUCHERS.JS: Error saat toggle active voucher:", error);
                alert('Error: ' + error.message);
            }
        }
    });
    
    // Muat data voucher saat halaman siap
    console.log("ADMIN-VOUCHERS.JS: Memanggil loadVouchers() untuk pertama kali.");
    loadVouchers();
});

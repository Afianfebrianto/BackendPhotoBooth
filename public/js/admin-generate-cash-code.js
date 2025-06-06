// backend-api/public/js/admin-generate-cash-code.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("ADMIN-GENERATE-CASH-CODE.JS: DOMContentLoaded.");

    const generateCashCodeForm = document.getElementById('generateCashCodeForm');
    const numberOfCodesInput = document.getElementById('numberOfCodes');
    const amountPerCodeInput = document.getElementById('amountPerCode');
    const cashVoucherCodeInput = document.getElementById('cashVoucherCode');
    const expiryDateInput = document.getElementById('expiryDateInput');
    const unlimitedExpiryCheckbox = document.getElementById('unlimitedExpiryCheckbox');
    
    const generatedCodeResultDiv = document.getElementById('generatedCodeResult');
    const generatedCodesTableBody = document.getElementById('generatedCodesTableBody');
    const resultTitle = document.getElementById('resultTitle');
    
    const generateErrorDiv = document.getElementById('generateError');
    const generateCodeButton = document.getElementById('generateCodeButton');
    const generateProgressDiv = document.getElementById('generateProgress');
    const progressBar = generateProgressDiv.querySelector('.progress-bar');
    const progressStatusText = document.getElementById('progressStatusText');

    // Handle checkbox unlimited expiry
    if (unlimitedExpiryCheckbox && expiryDateInput) {
        unlimitedExpiryCheckbox.addEventListener('change', function() {
            expiryDateInput.disabled = this.checked;
            if (this.checked) {
                expiryDateInput.value = ''; // Kosongkan tanggal jika unlimited
            }
        });
    }

    if (generateCashCodeForm) {
        console.log("ADMIN-GENERATE-CASH-CODE.JS: Form #generateCashCodeForm ditemukan.");
        generateCashCodeForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log("ADMIN-GENERATE-CASH-CODE.JS: Form generate kode disubmit.");

            generatedCodeResultDiv.style.display = 'none';
            generatedCodesTableBody.innerHTML = ''; // Kosongkan tabel hasil sebelumnya
            generateErrorDiv.style.display = 'none';
            generateErrorDiv.textContent = '';
            generateProgressDiv.style.display = 'none';
            progressBar.style.width = '0%';
            progressBar.textContent = '0%';
            progressStatusText.textContent = '';

            generateCodeButton.disabled = true;
            generateCodeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

            const numberOfCodes = parseInt(numberOfCodesInput.value, 10);
            const amountPerCode = parseFloat(amountPerCodeInput.value);
            const voucherCode = cashVoucherCodeInput.value.trim();
            let expiryDate = expiryDateInput.value;

            if (unlimitedExpiryCheckbox.checked || !expiryDate) {
                expiryDate = null; // Kirim null jika unlimited atau kosong
            }

            if (isNaN(numberOfCodes) || numberOfCodes < 1 || numberOfCodes > 100) { // Batasi max 100 per request
                generateErrorDiv.textContent = 'Jumlah kode harus antara 1 dan 100.';
                generateErrorDiv.style.display = 'block';
                generateCodeButton.disabled = false;
                generateCodeButton.innerHTML = '<i class="fas fa-cogs"></i> Generate Kode Pembayaran';
                return;
            }
            if (isNaN(amountPerCode) || amountPerCode <= 0) {
                generateErrorDiv.textContent = 'Harga per kode harus angka positif.';
                generateErrorDiv.style.display = 'block';
                generateCodeButton.disabled = false;
                generateCodeButton.innerHTML = '<i class="fas fa-cogs"></i> Generate Kode Pembayaran';
                return;
            }

            const payload = {
                count: numberOfCodes,
                amount: amountPerCode, // Ini adalah harga dasar sebelum voucher
                voucher_code: voucherCode || null,
                expiry_date_input: expiryDate // Kirim tanggal atau null
            };

            console.log("ADMIN-GENERATE-CASH-CODE.JS: Mengirim data ke API /api/cash-codes/generate-batch:", payload);
            generateProgressDiv.style.display = 'block';
            progressStatusText.textContent = `Memulai pembuatan ${numberOfCodes} kode...`;

            try {
                if (typeof fetchWithAuth !== 'function') {
                    throw new Error("Fungsi otentikasi (fetchWithAuth) tidak ditemukan.");
                }

                // Kita akan menggunakan endpoint baru untuk batch generation
                const response = await fetchWithAuth('/api/cash-codes/generate-batch', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                console.log("ADMIN-GENERATE-CASH-CODE.JS: Respons dari server:", result);

                if (result.success && Array.isArray(result.data)) {
                    resultTitle.textContent = `${result.data.length} Kode Pembayaran Berhasil Dibuat:`;
                    result.data.forEach((codeData, index) => {
                        progressBar.style.width = `${((index + 1) / result.data.length) * 100}%`;
                        progressBar.textContent = `${Math.round(((index + 1) / result.data.length) * 100)}%`;

                        const expiryDisplay = codeData.expires_at ? new Date(codeData.expires_at).toLocaleDateString('id-ID') : 'Tidak Terbatas';
                        generatedCodesTableBody.innerHTML += `
                            <tr>
                                <td>${index + 1}</td>
                                <td><strong>${codeData.code}</strong></td>
                                <td class="text-right">Rp ${parseFloat(codeData.baseAmount).toLocaleString('id-ID')}</td>
                                <td class="text-right">Rp ${parseFloat(codeData.discountApplied).toLocaleString('id-ID')}</td>
                                <td class="text-right font-weight-bold">Rp ${parseFloat(codeData.amount).toLocaleString('id-ID')}</td>
                                <td>${codeData.appliedVoucherCode || '-'}</td>
                                <td>${expiryDisplay}</td>
                            </tr>
                        `;
                    });
                    generatedCodeResultDiv.style.display = 'block';
                    progressStatusText.textContent = `Selesai! ${result.data.length} kode berhasil dibuat.`;
                    // cashVoucherCodeInput.value = ''; // Opsional: reset voucher input
                } else {
                    generateErrorDiv.textContent = result.message || 'Gagal generate kode pembayaran.';
                    generateErrorDiv.style.display = 'block';
                    progressStatusText.textContent = 'Gagal.';
                }
            } catch (error) {
                console.error('ADMIN-GENERATE-CASH-CODE.JS: Error saat generate kode:', error);
                let errorMessage = 'Terjadi kesalahan jaringan atau server.';
                if (error && error.message) { errorMessage = error.message; }
                generateErrorDiv.textContent = errorMessage;
                generateErrorDiv.style.display = 'block';
                progressStatusText.textContent = 'Error!';
            } finally {
                generateCodeButton.disabled = false;
                generateCodeButton.innerHTML = '<i class="fas fa-cogs"></i> Generate Kode Pembayaran';
                // Sembunyikan progress bar setelah beberapa saat jika tidak error
                if (!generateErrorDiv.textContent) {
                    // setTimeout(() => { generateProgressDiv.style.display = 'none'; }, 3000);
                }
            }
        });
    } else {
        console.warn("ADMIN-GENERATE-CASH-CODE.JS: Form #generateCashCodeForm tidak ditemukan.");
    }
});

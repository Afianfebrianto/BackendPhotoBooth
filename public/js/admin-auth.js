// backend-api/public/js/admin-auth.js

// --- Fungsi Utilitas Otentikasi ---
function storeLoginData(token, user) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('adminToken', token);
        localStorage.setItem('adminUser', JSON.stringify(user));
        console.log('AuthJS: Token dan user info DISIMPAN di localStorage.');
    } else {
        console.error('AuthJS: localStorage tidak tersedia.');
    }
}

function getLoggedInUser() {
    if (typeof localStorage !== 'undefined') {
        const userStr = localStorage.getItem('adminUser');
        try {
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            console.error('AuthJS: Gagal parse adminUser dari localStorage', e);
            localStorage.removeItem('adminUser'); // Hapus data korup
            return null;
        }
    }
    return null;
}

function getToken() {
    if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('adminToken');
    }
    return null;
}

function logoutUser() {
    console.log('AuthJS (logoutUser): Memulai proses logout client-side...');
    if (typeof localStorage !== 'undefined') {
        const tokenBefore = localStorage.getItem('adminToken');
        const userBefore = localStorage.getItem('adminUser');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        const tokenAfter = localStorage.getItem('adminToken');
        const userAfter = localStorage.getItem('adminUser');
        console.log('AuthJS (logoutUser): Token sebelum dihapus:', tokenBefore);
        console.log('AuthJS (logoutUser): User sebelum dihapus:', userBefore);
        console.log('AuthJS (logoutUser): Token SETELAH dihapus:', tokenAfter); // Seharusnya null
        console.log('AuthJS (logoutUser): User SETELAH dihapus:', userAfter);   // Seharusnya null
    } else {
        console.warn('AuthJS (logoutUser): localStorage tidak tersedia saat logout.');
    }
    
    const currentPath = window.location.pathname;
    console.log('AuthJS (logoutUser): Path saat ini:', currentPath);
    // Arahkan ke halaman login setelah token dihapus
    // Tidak perlu cek currentPath di sini karena kita ingin selalu ke login setelah logout.
    console.log('AuthJS (logoutUser): Mengarahkan ke /admin/login?success=Anda telah berhasil logout.');
    window.location.href = '/admin/login?success=Anda telah berhasil logout.';
}

function protectPageClientSide() {
    const token = getToken();
    const user = getLoggedInUser();
    const currentPath = window.location.pathname;
    // Normalisasi path login untuk mencakup kemungkinan tanpa trailing slash
    const isLoginPage = currentPath === '/admin/login' || currentPath === '/admin/login/' || currentPath === '/admin/login.html';

    console.log(`AuthJS (ProtectPage): Path saat ini: ${currentPath}, Apakah halaman login? ${isLoginPage}`);
    console.log(`AuthJS (ProtectPage): Token ditemukan di localStorage: ${token ? 'ADA' : 'TIDAK ADA'}`);
    console.log(`AuthJS (ProtectPage): User info ditemukan di localStorage: ${user ? 'ADA' : 'TIDAK ADA'}`);

    if (isLoginPage) {
        if (token && user) {
            console.log('AuthJS (ProtectPage): Sudah ada token & user di halaman login. Redirect ke /admin/dashboard.');
            window.location.href = '/admin/dashboard';
            return false; // Redirecting
        }
        console.log('AuthJS (ProtectPage): Di halaman login, tidak ada token/user. Izinkan akses.');
    } else { // Untuk halaman selain login
        if (!token || !user) {
            console.log('AuthJS (ProtectPage): Tidak ada token atau user di halaman terproteksi. Redirect ke /admin/login.');
            window.location.href = '/admin/login';
            return false; // Redirecting
        }
        console.log('AuthJS (ProtectPage): Ada token dan user di halaman terproteksi. Izinkan akses.');
    }
    return true; // Pengguna diizinkan di halaman ini
}

async function fetchWithAuth(url, options = {}) {
    // ... (fungsi fetchWithAuth seperti sebelumnya, pastikan memanggil logoutUser() jika token expired/unauthorized)
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    console.log(`AuthJS (Fetch): Melakukan fetch ke ${url} dengan token: ${token ? 'ADA' : 'TIDAK ADA'}`);

    try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                const errorData = await response.json().catch(() => ({ message: 'Respons error tidak valid' }));
                console.warn(`AuthJS (Fetch): Akses API ditolak (status ${response.status}). Pesan: ${errorData.message}`);
                if (errorData.code === 'TOKEN_EXPIRED' || response.status === 401) { // 401 juga bisa berarti token salah/tidak ada
                    console.log('AuthJS (Fetch): Token kedaluwarsa atau tidak sah, memanggil logoutUser().');
                    logoutUser(); 
                    return Promise.reject(new Error(errorData.message || 'Sesi Anda telah berakhir atau token tidak valid.'));
                }
            }
        }
        return response;
    } catch (error) {
        console.error('AuthJS (Fetch): Network error atau kesalahan fetch:', error);
        throw error;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log('AuthJS: DOMContentLoaded event triggered untuk path:', window.location.pathname);
    if (!protectPageClientSide()) {
        console.log('AuthJS: protectPageClientSide melakukan redirect, eksekusi dihentikan.');
        return; 
    }
    console.log('AuthJS: protectPageClientSide mengizinkan akses ke halaman saat ini.');

    const loginForm = document.getElementById('loginForm');
    const loginErrorElement = document.getElementById('login-error');
    
    // Target semua tombol/link logout yang mungkin ada
    const logoutButtons = document.querySelectorAll('#logoutButton, #logoutButtonFromModal, #confirmLogoutButton, a[href="/admin/logout"]');


    if (loginForm) {
        console.log('AuthJS: Formulir login ditemukan.');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginErrorElement.style.display = 'none';
            loginErrorElement.textContent = '';
            try {
                const username = loginForm.username.value;
                const password = loginForm.password.value;
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                const result = await response.json();
                if (result.success && result.token) {
                    storeLoginData(result.token, result.user);
                    window.location.href = '/admin/dashboard';
                } else {
                    loginErrorElement.textContent = result.message || 'Login gagal.';
                    loginErrorElement.style.display = 'block';
                }
            } catch (error) {
                console.error('AuthJS: Error saat submit login:', error);
                loginErrorElement.textContent = 'Terjadi kesalahan saat mencoba login.';
                loginErrorElement.style.display = 'block';
            }
        });
    }

    function handleLogoutClick(e) {
        e.preventDefault(); // Cegah aksi default link/form
        console.log('AuthJS: Tombol/Link Logout diklik via handleLogoutClick.');
        
        // Opsional: Panggil API logout server jika ada proses server-side yang perlu dijalankan
        // fetchWithAuth('/api/auth/logout', { method: 'POST' }) // Asumsikan API logout adalah POST
        //     .then(response => response.json())
        //     .then(data => {
        //         console.log('AuthJS: Respons API Logout Server:', data.message);
        //     })
        //     .catch(error => {
        //         console.warn('AuthJS: Error memanggil API logout server (mungkin tidak masalah):', error.message);
        //     })
        //     .finally(() => {
        //         logoutUser(); // Selalu hapus token lokal dan redirect
        //     });
        // Untuk sekarang, kita langsung panggil logoutUser() untuk kesederhanaan
        logoutUser();
    }

    if (logoutButtons.length > 0) {
        logoutButtons.forEach(button => {
            console.log('AuthJS: Tombol/Link logout ditemukan, memasang listener:', button);
            button.addEventListener('click', handleLogoutClick);
        });
    } else {
        console.log('AuthJS: Tidak ada tombol/link logout yang ditemukan dengan selector yang diberikan.');
    }

    const user = getLoggedInUser();
    if (user) {
        // ... (logika update UI dengan info user seperti sebelumnya)
        const usernameDisplayElements = document.querySelectorAll('.loggedInUsername');
        const userRoleDisplayElements = document.querySelectorAll('.loggedInUserRole');
        usernameDisplayElements.forEach(el => el.textContent = user.username);
        userRoleDisplayElements.forEach(el => el.textContent = user.role);
        
        const topbarUsername = document.querySelector('#userDropdown .text-gray-600.small');
        if (topbarUsername) {
            const userRoleSpan = topbarUsername.querySelector('.loggedInUserRole');
            if (userRoleSpan && topbarUsername.childNodes.length > 0 && topbarUsername.childNodes[0].nodeType === Node.TEXT_NODE) {
                 topbarUsername.childNodes[0].nodeValue = `${user.username} (`;
            } else {
                 topbarUsername.textContent = `${user.username} (${user.role})`;
            }
        }
    }
});

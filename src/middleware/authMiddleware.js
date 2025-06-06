// backend-api/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("Kesalahan Fatal: JWT_SECRET belum diatur di file .env atau tidak termuat dengan benar.");
    process.exit(1);
}

// Middleware untuk melindungi endpoint API (menggunakan Bearer Token dari header Authorization)
const authenticateTokenApi = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

    if (token == null) {
        console.warn('AUTH_MIDDLEWARE_API: Token tidak ditemukan di header Authorization.');
        return res.status(401).json({ success: false, message: 'Akses API ditolak: Token otentikasi tidak disediakan.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.warn("AUTH_MIDDLEWARE_API: Verifikasi token gagal:", err.message);
            // Kirim pesan error yang lebih spesifik jika token kedaluwarsa
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Akses API ditolak: Token Anda telah kedaluwarsa. Silakan login kembali.', code: 'TOKEN_EXPIRED' });
            }
            return res.status(403).json({ success: false, message: 'Akses API ditolak: Token tidak valid.' });
        }
        req.user = user; // Simpan informasi user dari token ke object request
        console.log('AUTH_MIDDLEWARE_API: Token valid. User:', user.username, 'Role:', user.role);
        next(); // Lanjutkan ke handler route berikutnya
    });
};

// Middleware untuk otorisasi berdasarkan role (tetap berguna)
const authorizeRole = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    return (req, res, next) => {
        // req.user akan di-set oleh authenticateTokenApi
        if (!req.user || (roles.length && !roles.includes(req.user.role))) {
            console.warn(`AUTH_MIDDLEWARE_ROLE: Akses ditolak untuk user ${req.user?.username}. Role dibutuhkan: ${roles.join('/')}, Role user: ${req.user?.role}`);
            return res.status(403).json({ success: false, message: 'Akses ditolak: Anda tidak memiliki izin (role) yang sesuai untuk mengakses sumber daya ini.' });
        }
        next();
    };
};

module.exports = {
    authenticateTokenApi,
    authorizeRole
};

// backend-api/src/controllers/authController.js
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h'; // Token berlaku 1 jam secara default

if (!JWT_SECRET) {
    console.error("Kesalahan Fatal: JWT_SECRET belum diatur di file .env.");
    process.exit(1);
}

exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username dan password harus diisi.' });
    }

    try {
        console.log(`AUTH_CONTROLLER: Mencoba login untuk user: ${username}`);
        const { rows } = await db.query('SELECT id, username, password_hash, role, is_active FROM admin_users WHERE username = $1', [username]);

        if (rows.length === 0) {
            console.log(`AUTH_CONTROLLER: User ${username} tidak ditemukan.`);
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        const user = rows[0];

        if (!user.is_active) {
            console.log(`AUTH_CONTROLLER: User ${username} tidak aktif.`);
            return res.status(403).json({ success: false, message: 'Akun pengguna tidak aktif.' });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordMatch) {
            console.log(`AUTH_CONTROLLER: Password salah untuk user ${username}.`);
            return res.status(401).json({ success: false, message: 'Username atau password salah.' });
        }

        const tokenPayload = {
            userId: user.id,
            username: user.username,
            role: user.role
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        console.log(`AUTH_CONTROLLER: Login berhasil untuk user ${username}. Token JWT dibuat.`);
        res.json({
            success: true,
            message: 'Login berhasil.',
            token: token, // Kirim token di body respons
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error('AUTH_CONTROLLER: Error saat login:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
};

// Logout sekarang lebih merupakan aksi client-side (menghapus token dari localStorage)
// Endpoint server ini bisa ada untuk invalidasi token sisi server jika kamu implementasi blacklist token,
// tapi untuk sekarang, cukup respons sukses.
exports.logout = (req, res) => {
    // Jika kamu ingin mencatat logout di server atau melakukan sesuatu dengan token yang dikirim (misalnya blacklist),
    // kamu bisa menggunakan middleware authenticateTokenApi di sini.
    // Untuk sekarang, kita asumsikan klien hanya menghapus tokennya.
    console.log("AUTH_CONTROLLER: Logout dipanggil (client-side akan menghapus token).");
    res.json({ success: true, message: 'Logout berhasil dari sisi server. Klien harus menghapus token.' });
};

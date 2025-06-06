// backend-api/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./src/db'); // Pastikan path ini benar
const expressLayouts = require('express-ejs-layouts');

// Impor Routes API
const authApiRoutes = require('./src/routes/authRoutes'); 
const voucherApiRoutes = require('./src/routes/voucherRoutes'); 
const cashCodeApiRoutes = require('./src/routes/cashCodeRoutes'); 
const transactionApiRoutes = require('./src/routes/transactionRoutes'); 
const dashboardApiRoutes = require('./src/routes/dashboardRoutes'); // <-- Impor route dashboard
// const reportApiRoutes = require('./src/routes/reportRoutes'); // Uncomment jika sudah dibuat

// Impor middleware otentikasi API (jika ada yang dipakai langsung di sini, tapi biasanya di file route API)
// const { authorizeRole } = require('./src/middleware/authMiddleware'); // Hanya jika dibutuhkan di sini

const app = express();
const PORT = process.env.API_PORT || 4000;

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views')); // Direktori untuk file .ejs
app.use(expressLayouts);
app.set('layout', 'layouts/admin_layout'); // File layout default untuk halaman admin

// Middleware Global
app.use(cors()); // Izinkan CORS
app.use(bodyParser.json()); // Untuk parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // Untuk parsing application/x-www-form-urlencoded
app.use(express.static(path.join(__dirname, 'public'))); // Sajikan file statis dari folder public

// Middleware logging global sederhana untuk semua request
app.use((req, res, next) => {
    console.log(`SERVER_JS_GLOBAL_LOG: Menerima ${req.method} request untuk ${req.originalUrl}`);
    next();
});

// --- Routes API ---
app.use('/api/auth', authApiRoutes);
app.use('/api/vouchers', voucherApiRoutes);
app.use('/api/cash-codes', cashCodeApiRoutes);
app.use('/api/transactions', transactionApiRoutes);
app.use('/api/dashboard', dashboardApiRoutes); // <-- Daftarkan route dashboard API
// app.use('/api/reports', reportApiRoutes);


// --- Routes untuk Halaman Web Admin ---
// Otentikasi dan proteksi halaman dilakukan oleh JavaScript sisi klien (admin-auth.js)

app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
    res.render('login', {
        layout: false, 
        title: 'Admin Login',
        error: req.query.error, 
        success: req.query.success
    });
});

app.get('/admin/dashboard', (req, res) => {
    res.render('dashboard', {
        currentPath: req.path,
        title: "Dashboard", 
        pageHeading: "Dashboard Utama",
        page_custom_scripts: `<script src="/js/admin-dashboard.js"></script>`
    });
});

app.get('/admin/cash-codes/generate', (req, res) => {
    res.render('admin-generate-cash-code', { 
        currentPath: req.path,
        title: "Generate Kode Cash",
        pageHeading: "Generate Kode Pembayaran Cash",
        page_custom_scripts: `
            <script src="/js/admin-generate-cash-code.js"></script> 
        `
    });
});

app.get('/admin/pending-cash-codes', (req, res) => {
    res.render('admin-pending-cash-codes', {
        currentPath: req.path,
        page_plugins_scripts: `
            <script src="/sb-admin-2/vendor/datatables/jquery.dataTables.min.js"></script>
            <script src="/sb-admin-2/vendor/datatables/dataTables.bootstrap4.min.js"></script>
            <link href="/sb-admin-2/vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">
        `,
        page_custom_scripts: `
            <script src="/js/admin-pending-cash-codes.js"></script> 
        `
    });
});

app.get('/admin/vouchers', (req, res) => {
    res.render('admin-vouchers', { 
        currentPath: req.path,
        page_plugins_scripts: `
            <script src="/sb-admin-2/vendor/datatables/jquery.dataTables.min.js"></script>
            <script src="/sb-admin-2/vendor/datatables/dataTables.bootstrap4.min.js"></script>
            <link href="/sb-admin-2/vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">
        `,
        page_custom_scripts: `
            <script src="/js/admin-vouchers.js"></script>
        `
    });
});

app.get('/admin/transactions', (req, res) => {
    res.render('admin-transactions', { 
        currentPath: req.path,
        title: "Daftar Transaksi",
        pageHeading: "Riwayat Transaksi",
        page_plugins_scripts: `
            <script src="/sb-admin-2/vendor/datatables/jquery.dataTables.min.js"></script>
            <script src="/sb-admin-2/vendor/datatables/dataTables.bootstrap4.min.js"></script>
            <link href="/sb-admin-2/vendor/datatables/dataTables.bootstrap4.min.css" rel="stylesheet">
        `,
        page_custom_scripts: `
            <script src="/js/admin-transactions.js"></script>
        `
    });
});

app.get('/admin/reports', (req, res) => {
    res.render('admin-reports', {
        currentPath: req.path,
        title: "Laporan",
        pageHeading: "Laporan Bulanan"
        // Tambahkan page_custom_scripts jika halaman laporan punya JS khusus
    });
});

app.get('/admin/logout', (req, res) => {
    console.log("SERVER: GET /admin/logout diakses. Mengarahkan ke login dengan pesan sukses.");
    res.redirect('/admin/login?success=Anda telah berhasil logout.');
});


// Test Route DB & API dasar (bisa dihapus jika tidak perlu)
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ success: true, message: 'Koneksi DB berhasil!', time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Gagal koneksi DB.', error: err.message });
    }
});
app.get('/api', (req, res) => {
  res.json({ message: 'Selamat datang di Backend API Photobooth! (Token-Based Auth)' });
});


// Error handling middleware (contoh sederhana)
app.use((err, req, res, next) => {
    console.error("Global error handler:", err.stack);
    // Kirim respons JSON jika request adalah API, atau render halaman error jika request halaman web
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server internal.' });
    } else {
        // Pertimbangkan untuk membuat halaman error.ejs yang lebih baik
        res.status(500).render('error', { // Asumsi kamu punya error.ejs
            layout: 'layouts/admin_layout', // Atau layout:false jika error page berdiri sendiri
            title: "Error Server",
            message: err.message,
            error: process.env.NODE_ENV === 'development' ? err : {} // Hanya tampilkan stack error di development
        });
    }
});

app.listen(PORT, () => {
  console.log(`Backend API Server dan Web Admin (Token-Based) berjalan di http://localhost:${PORT}`);
});

// backend-api/src/routes/cashCodeRoutes.js
const express = require('express');
const router = express.Router();
const cashCodeController = require('../controllers/cashCodeController');
const { authenticateTokenApi, authorizeRole } = require('../middleware/authMiddleware');

// Endpoint untuk Web Admin generate BATCH kode cash (dilindungi)
router.post('/generate-batch', authenticateTokenApi, authorizeRole(['admin', 'kasir']), cashCodeController.generateBatchCashCodes);

// Endpoint untuk Aplikasi Electron redeem kode cash
// Otentikasi untuk endpoint ini mungkin berbeda (misalnya, API key khusus untuk Electron app, atau tidak ada jika jaringan lokal aman)
// Untuk sekarang, kita tidak melindunginya dengan token admin, tapi ini perlu dipertimbangkan.
router.post('/redeem', cashCodeController.redeemCashCode);

// ENDPOINT BARU: Untuk Web Admin mendapatkan kode cash yang belum terpakai (PENDING)
router.get('/pending', authenticateTokenApi, authorizeRole(['admin', 'kasir']), cashCodeController.getPendingCashCodes);

// ENDPOINT BARU: Untuk Web Admin mengekspor kode cash pending ke Excel
router.get('/pending/export', authenticateTokenApi, authorizeRole(['admin', 'kasir']), cashCodeController.exportPendingCashCodesToExcel);


module.exports = router;

// backend-api/src/routes/voucherRoutes.js
const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/voucherController');
const { authenticateTokenApi, authorizeRole } = require('../middleware/authMiddleware');

// Endpoint ini untuk Electron App memvalidasi voucher (mungkin tidak perlu token admin)
router.post('/validate', voucherController.validateVoucher);

// --- Endpoint untuk Web Admin (dilindungi) ---

// GET semua voucher (admin & kasir bisa lihat)
router.get('/', authenticateTokenApi, authorizeRole(['admin', 'kasir']), voucherController.getAllVouchers);

// POST buat voucher baru (hanya admin)
router.post('/', authenticateTokenApi, authorizeRole(['admin']), voucherController.createVoucher);

// ENDPOINT BARU: POST untuk generate voucher massal (hanya admin)
router.post('/generate-batch', authenticateTokenApi, authorizeRole(['admin']), voucherController.generateBatchVouchers);

// PUT update voucher (hanya admin)
router.put('/:id', authenticateTokenApi, authorizeRole(['admin']), voucherController.updateVoucher);

// DELETE voucher (menonaktifkan) (hanya admin)
router.delete('/:id', authenticateTokenApi, authorizeRole(['admin']), voucherController.deleteVoucher);

module.exports = router;

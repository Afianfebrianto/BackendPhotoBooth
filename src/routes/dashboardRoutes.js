// backend-api/src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController'); // Pastikan controller diimpor
const { authenticateTokenApi, authorizeRole } = require('../middleware/authMiddleware');

// Endpoint untuk mendapatkan statistik dashboard
router.get('/stats', authenticateTokenApi, authorizeRole(['admin', 'kasir']), dashboardController.getDashboardStats);

module.exports = router;
// backend-api/src/db.js
const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' }); // Muat variabel dari .env di root backend-api

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

pool.on('connect', () => {
  console.log('Backend API terhubung ke database PostgreSQL!');
});

pool.on('error', (err) => {
  console.error('Kesalahan koneksi database PostgreSQL:', err);
  process.exit(-1); // Keluar jika tidak bisa konek ke DB
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Ekspor pool jika perlu transaksi manual
};
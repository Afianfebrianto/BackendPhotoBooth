// backend-api/_createAdmin.js
// Jalankan skrip ini sekali saja dengan: node _createAdmin.js

const bcrypt = require('bcryptjs');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("--- Pembuatan User Admin Awal ---");

readline.question('Masukkan username untuk admin: ', (username) => {
  if (!username || username.trim() === '') {
    console.error('Username tidak boleh kosong.');
    readline.close();
    return;
  }
  readline.question(`Masukkan password untuk admin "${username}": `, async (password) => {
    if (!password || password.length < 6) { // Validasi panjang password dasar
      console.error('Password minimal harus 6 karakter.');
      readline.close();
      return;
    }
    try {
      const saltRounds = 10; // Jumlah salt rounds untuk bcrypt
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      console.log('\n==================================================================');
      console.log('USER ADMIN BERHASIL DIBUAT (DETAIL DI BAWAH):');
      console.log('==================================================================');
      console.log(`Username        : ${username}`);
      console.log(`Password (asli) : ${password} (JANGAN SIMPAN INI, HANYA UNTUK KAMU INGAT)`);
      console.log(`Password (hash) : ${hashedPassword} (SIMPAN HASH INI DI DATABASE)`);
      console.log('------------------------------------------------------------------');
    //   console.log('Contoh Perintah SQL INSERT (ganti 'admin' dengan role yang sesuai jika perlu):');
      console.log(
        `INSERT INTO admin_users (username, password_hash, role, is_active, created_at, updated_at) VALUES ('<span class="math-inline">\{username\.trim\(\)\}', '</span>{hashedPassword}', 'admin', TRUE, NOW(), NOW());`
      );
      console.log('==================================================================');
      console.log('Jalankan perintah SQL di atas pada database PostgreSQL-mu.');
      console.log('Setelah itu, hapus atau amankan file _createAdmin.js ini.');
      console.log('==================================================================');

    } catch (err) {
      console.error('Error saat membuat hash password:', err);
    } finally {
      readline.close();
    }
  });
});
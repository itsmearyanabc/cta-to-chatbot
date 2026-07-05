import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

async function reset() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const hash = await bcrypt.hash('admin123', 12);
  await pool.query('UPDATE admin_users SET password_hash = ? WHERE username = ?', [hash, 'admin']);
  console.log('Password reset to admin123');
  process.exit(0);
}
reset();

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

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const hash = await bcrypt.hash(adminPassword, 12);
  
  // Check if admin exists
  const [rows]: any = await pool.query('SELECT * FROM admin_users WHERE username = ?', [adminUsername]);
  if (rows.length === 0) {
    await pool.query('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', [adminUsername, hash]);
    console.log(`Admin user created with username "${adminUsername}" and password from env`);
  } else {
    await pool.query('UPDATE admin_users SET password_hash = ? WHERE username = ?', [hash, adminUsername]);
    console.log(`Password reset for user "${adminUsername}"`);
  }
  
  process.exit(0);
}
reset();

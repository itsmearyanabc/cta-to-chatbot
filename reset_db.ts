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
  
  // Check if admin exists
  const [rows]: any = await pool.query('SELECT * FROM admin_users WHERE username = ?', ['admin']);
  if (rows.length === 0) {
    await pool.query('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    console.log('Admin user created with password admin123');
  } else {
    await pool.query('UPDATE admin_users SET password_hash = ? WHERE username = ?', [hash, 'admin']);
    console.log('Password reset to admin123');
  }
  
  process.exit(0);
}
reset();

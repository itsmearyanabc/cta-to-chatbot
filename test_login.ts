import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

async function testLogin(username: string, password: string) {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM admin_users WHERE username = ?', [username]);
  
  if (rows.length === 0) {
    console.log('User not found in DB!');
    process.exit(1);
  }

  const user = rows[0];
  console.log(`Found user: ${user.username}, hash: ${user.password_hash}`);
  
  const isMatch = await bcrypt.compare(password, user.password_hash);
  console.log(`Password match result for "${password}":`, isMatch);
  
  process.exit(0);
}
testLogin('admin', 'admin123');

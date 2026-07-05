import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

let pool: mysql.Pool | null = null;

// JWT secret — generated once per server instance if not in .env
const JWT_SECRET = process.env.JWT_SECRET || 'chatbot_admin_jwt_secret_' + Date.now();
const JWT_EXPIRY = '24h';

export class AuthService {
  /**
   * Initialize the admin_users table and seed a default admin account.
   */
  static async init(dbPool: mysql.Pool): Promise<boolean> {
    pool = dbPool;
    try {
      const conn = await pool.getConnection();

      await conn.query(`
        CREATE TABLE IF NOT EXISTS admin_users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Check if any admin exists
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM admin_users'
      );

      if (rows[0].count === 0) {
        // Seed default admin account
        const hash = await bcrypt.hash('admin123', 12);
        await conn.query(
          'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
          ['admin', hash]
        );
        console.log('👤 Default admin account created (admin / admin123)');
      }

      conn.release();
      return true;
    } catch (error: any) {
      console.error('❌ AuthService init failed:', error.message);
      return false;
    }
  }

  /**
   * Authenticate an admin user. Returns a JWT token on success, null on failure.
   */
  static async login(username: string, password: string): Promise<string | null> {
    if (!pool) {
      console.log('[DEBUG] AuthService.login failed: pool is null');
      return null;
    }
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id, username, password_hash FROM admin_users WHERE username = ?',
        [username]
      );

      if (rows.length === 0) {
        console.log('[DEBUG] AuthService.login failed: User not found in DB');
        return null;
      }

      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      
      console.log(`[DEBUG] AuthService.login: comparing provided password with hash: ${isMatch}`);

      if (!isMatch) {
        console.log('[DEBUG] AuthService.login failed: Password mismatch');
        return null;
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );

      console.log('[DEBUG] AuthService.login succeeded');
      return token;
    } catch (error: any) {
      console.error('[DEBUG] AuthService.login error:', error.message);
      return null;
    }
  }

  /**
   * Verify a JWT token. Returns the decoded payload or null.
   */
  static verifyToken(token: string): { id: number; username: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Change the password for an admin user.
   */
  static async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (!pool) return { success: false, message: 'Database not connected' };

    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT password_hash FROM admin_users WHERE id = ?',
        [userId]
      );

      if (rows.length === 0) return { success: false, message: 'User not found' };

      const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!isMatch) return { success: false, message: 'Current password is incorrect' };

      if (newPassword.length < 6) return { success: false, message: 'New password must be at least 6 characters' };

      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query(
        'UPDATE admin_users SET password_hash = ? WHERE id = ?',
        [hash, userId]
      );

      return { success: true, message: 'Password updated successfully' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}

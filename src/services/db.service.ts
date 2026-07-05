import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool: mysql.Pool | null = null;
let isConnected = false;

export class DBService {
  /**
   * Initialize the database pool and create the chat_history table.
   * Returns the pool on success (for other services to use), or null on failure.
   * The server keeps running even if this fails.
   */
  static async init(): Promise<mysql.Pool | null> {
    try {
      pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'chatbot_db',
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 10000,
      });

      // Test the connection
      const connection = await pool.getConnection();

      // Create chat history table
      await connection.query(`
        CREATE TABLE IF NOT EXISTS chat_history (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          platform VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
          role VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_platform (user_id, platform)
        )
      `);

      connection.release();
      isConnected = true;
      return pool;
    } catch (error: any) {
      console.error('❌ Database connection failed:', error.message);
      pool = null;
      isConnected = false;
      return null;
    }
  }

  /**
   * Quick connection test (for status endpoints).
   */
  static async testConnection(): Promise<boolean> {
    if (!pool) return false;
    try {
      const conn = await pool.getConnection();
      conn.release();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save a message to chat history.
   * Silently skips if DB is not connected.
   */
  static async saveMessage(userId: string, role: 'user' | 'model', content: string): Promise<void> {
    if (!pool || !isConnected) return;
    try {
      await pool.query(
        'INSERT INTO chat_history (user_id, platform, role, content) VALUES (?, ?, ?, ?)',
        [userId, 'whatsapp', role, content]
      );
    } catch (error: any) {
      console.error('DB save error:', error.message);
    }
  }

  /**
   * Get the last N messages for a user for AI conversation context.
   * Returns empty array if DB is not connected.
   */
  static async getHistory(userId: string, limit: number = 10): Promise<{ role: string; parts: { text: string }[] }[]> {
    if (!pool || !isConnected) return [];
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT role, content FROM chat_history WHERE user_id = ? AND platform = ? ORDER BY created_at DESC LIMIT ?',
        [userId, 'whatsapp', limit]
      );
      return rows.reverse().map(row => ({
        role: row.role,
        parts: [{ text: row.content }]
      }));
    } catch (error: any) {
      console.error('DB history fetch error:', error.message);
      return [];
    }
  }

  /**
   * Get all unique conversations (for the admin panel chat list).
   */
  static async getAllConversations(): Promise<{ userId: string; lastMessage: string; lastTime: string; messageCount: number }[]> {
    if (!pool || !isConnected) return [];
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(`
        SELECT 
          user_id,
          (SELECT content FROM chat_history c2 WHERE c2.user_id = c1.user_id ORDER BY created_at DESC LIMIT 1) as last_message,
          MAX(created_at) as last_time,
          COUNT(*) as message_count
        FROM chat_history c1
        GROUP BY user_id
        ORDER BY last_time DESC
      `);
      return rows.map(row => ({
        userId: row.user_id,
        lastMessage: row.last_message,
        lastTime: row.last_time,
        messageCount: row.message_count,
      }));
    } catch (error: any) {
      console.error('DB conversations fetch error:', error.message);
      return [];
    }
  }
}

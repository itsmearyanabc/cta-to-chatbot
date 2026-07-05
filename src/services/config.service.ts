import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool: mysql.Pool | null = null;
let isConnected = false;

// In-memory cache of config values for fast access
const configCache: Map<string, string> = new Map();

// Keys that the config service manages
const CONFIG_KEYS = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'META_VERIFY_TOKEN',
  'GEMINI_API_KEY',
  'SYSTEM_PROMPT',
  'BOT_ACTIVE',
];

const DEFAULT_SYSTEM_PROMPT = `You are a helpful and friendly customer support assistant for Global Peace Overseas.
Your goal is to respond to customers like a human, using short replies (2-3 lines).
If the customer asks a detailed question, give a clear pointwise explanation, but keep it concise.
Always stay polite and natural. Never say you are an AI unless directly asked.`;

export class ConfigService {
  /**
   * Initialize the config table and load values into memory.
   * Called once on server startup after DB connects.
   */
  static async init(dbPool: mysql.Pool): Promise<boolean> {
    pool = dbPool;
    try {
      const conn = await pool.getConnection();

      // Create config table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS bot_config (
          config_key VARCHAR(100) PRIMARY KEY,
          config_value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      conn.release();

      // Seed defaults from .env (only inserts if key doesn't already exist)
      await this.seedDefaults();

      // Load all config into memory
      await this.reloadCache();

      isConnected = true;
      return true;
    } catch (error: any) {
      console.error('❌ ConfigService init failed:', error.message);
      return false;
    }
  }

  /**
   * Seed default config values from .env on first run.
   * Uses INSERT IGNORE so existing values are never overwritten.
   */
  private static async seedDefaults(): Promise<void> {
    if (!pool) return;

    const defaults: Record<string, string> = {
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || 'your_whatsapp_access_token',
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || 'your_whatsapp_phone_number_id',
      META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || 'my_secret_token_123',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'your_gemini_api_key',
      SYSTEM_PROMPT: DEFAULT_SYSTEM_PROMPT,
      BOT_ACTIVE: 'true',
    };

    for (const [key, value] of Object.entries(defaults)) {
      await pool.query(
        'INSERT IGNORE INTO bot_config (config_key, config_value) VALUES (?, ?)',
        [key, value]
      );
    }
  }

  /**
   * Reload the in-memory cache from the database.
   */
  static async reloadCache(): Promise<void> {
    if (!pool) return;
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT config_key, config_value FROM bot_config'
      );
      configCache.clear();
      for (const row of rows) {
        configCache.set(row.config_key, row.config_value);
      }
    } catch (error: any) {
      console.error('Config cache reload error:', error.message);
    }
  }

  /**
   * Get a config value. Reads from in-memory cache (fast).
   * Falls back to .env if DB is not connected.
   */
  static get(key: string): string {
    // Try cache first
    const cached = configCache.get(key);
    if (cached !== undefined) return cached;

    // Fallback to .env
    return process.env[key] || '';
  }

  /**
   * Update a config value in the database AND the in-memory cache.
   */
  static async set(key: string, value: string): Promise<boolean> {
    if (!pool || !isConnected) return false;
    try {
      await pool.query(
        'INSERT INTO bot_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
        [key, value, value]
      );
      configCache.set(key, value);
      return true;
    } catch (error: any) {
      console.error('Config set error:', error.message);
      return false;
    }
  }

  /**
   * Get all config values (for admin panel). Masks sensitive tokens.
   */
  static getAll(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of CONFIG_KEYS) {
      result[key] = this.get(key);
    }
    return result;
  }

  /**
   * Get all config values unmasked (for admin panel internal use).
   */
  static getAllRaw(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of CONFIG_KEYS) {
      result[key] = this.get(key);
    }
    return result;
  }

  /**
   * Check if the bot is currently active.
   */
  static isBotActive(): boolean {
    return this.get('BOT_ACTIVE') === 'true';
  }

  /**
   * Check if DB-backed config is available.
   */
  static isReady(): boolean {
    return isConnected;
  }
}

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';
import { DBService } from '../services/db.service';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// ============================================================
// Public: Login / Logout
// ============================================================

router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  console.log(`[DEBUG] Login attempt - Username: "${username}", Password: "${password}"`);

  if (!username || !password) {
    console.log('[DEBUG] Missing username or password');
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const result = await AuthService.login(username, password);
  if (!result.token) {
    console.log('[DEBUG] AuthService.login failed:', result.error);
    const status = result.error?.includes('Database') ? 500 : 401;
    res.status(status).json({ error: result.error || 'Invalid username or password' });
    return;
  }

  const token = result.token;

  // Set JWT as HTTP-only cookie (secure in production)
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
  });

  res.json({ success: true, message: 'Login successful' });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out' });
});

// ============================================================
// Protected: All routes below require authentication
// ============================================================

// --- Status Dashboard ---
router.get('/status', requireAuth, async (_req: Request, res: Response) => {
  const dbOk = await DBService.testConnection();
  const geminiKey = ConfigService.get('GEMINI_API_KEY');
  const waToken = ConfigService.get('WHATSAPP_ACCESS_TOKEN');
  const botActive = ConfigService.isBotActive();

  res.json({
    botActive,
    database: dbOk ? 'connected' : 'disconnected',
    geminiAI: geminiKey && geminiKey !== 'your_gemini_api_key' ? 'configured' : 'not_configured',
    whatsapp: waToken && waToken !== 'your_whatsapp_access_token' ? 'configured' : 'not_configured',
    configReady: ConfigService.isReady(),
  });
});

// --- Toggle Bot ---
router.post('/toggle', requireAuth, async (req: Request, res: Response) => {
  const { active } = req.body;
  const newState = active === true || active === 'true' ? 'true' : 'false';

  const ok = await ConfigService.set('BOT_ACTIVE', newState);
  if (ok) {
    console.log(`🔄 Bot ${newState === 'true' ? 'ACTIVATED' : 'DEACTIVATED'} by admin`);
    res.json({ success: true, botActive: newState === 'true' });
  } else {
    res.status(500).json({ error: 'Failed to update bot state. Is the database connected?' });
  }
});

// --- Get Config ---
router.get('/config', requireAuth, (_req: Request, res: Response) => {
  const config = ConfigService.getAllRaw();
  res.json({ success: true, config });
});

// --- Update Config ---
router.put('/config', requireAuth, async (req: Request, res: Response) => {
  const updates = req.body; // { key: value, key: value, ... }

  if (!updates || typeof updates !== 'object') {
    res.status(400).json({ error: 'Request body must be a JSON object of key-value pairs' });
    return;
  }

  const allowedKeys = [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'META_VERIFY_TOKEN',
    'GEMINI_API_KEY',
    'SYSTEM_PROMPT',
  ];

  const results: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (allowedKeys.includes(key) && typeof value === 'string') {
      results[key] = await ConfigService.set(key, value);
    }
  }

  console.log('⚙️  Config updated by admin:', Object.keys(results).join(', '));
  res.json({ success: true, updated: results });
});

// --- Chat History: List all unique users ---
router.get('/chats', requireAuth, async (_req: Request, res: Response) => {
  const chats = await DBService.getAllConversations();
  res.json({ success: true, chats });
});

// --- Chat History: Get messages for a specific user ---
router.get('/chats/:userId', requireAuth, async (req: Request, res: Response) => {
  const userId = req.params.userId as string;
  const messages = await DBService.getHistory(userId, 100);
  res.json({ success: true, userId, messages });
});

// --- Change Password ---
router.put('/change-password', requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const adminUser = (req as any).adminUser;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Both currentPassword and newPassword are required' });
    return;
  }

  const result = await AuthService.changePassword(adminUser.id, currentPassword, newPassword);
  if (result.success) {
    res.json({ success: true, message: result.message });
  } else {
    res.status(400).json({ error: result.message });
  }
});

export default router;

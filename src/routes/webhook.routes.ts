import { Router, Request, Response } from 'express';
import { MetaService } from '../services/meta.service';
import { AIService } from '../services/ai.service';
import { ConfigService } from '../services/config.service';

const router = Router();

// ============================================================
// WhatsApp Webhook — Verification (GET)
// ============================================================
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const verifyToken = ConfigService.get('META_VERIFY_TOKEN');

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.warn('❌ WhatsApp webhook verification failed — token mismatch');
    res.sendStatus(403);
  }
});

// ============================================================
// WhatsApp Webhook — Incoming Messages (POST)
// ============================================================
router.post('/whatsapp', async (req: Request, res: Response) => {
  const body = req.body;

  // Always respond 200 immediately so Meta doesn't retry
  res.status(200).send('EVENT_RECEIVED');

  if (body.object !== 'whatsapp_business_account') return;

  // ---- CHECK IF BOT IS ACTIVE ----
  if (!ConfigService.isBotActive()) {
    console.log('⏸️  Bot is deactivated — ignoring incoming message');
    return;
  }

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    // Handle incoming text messages
    const messages = value?.messages;
    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from;

      if (message.type === 'text' && message.text?.body) {
        const userText = message.text.body;
        console.log(`📩 WhatsApp from ${from}: "${userText}"`);

        const aiReply = await AIService.generateReply(from, userText);
        console.log(`🤖 AI reply to ${from}: "${aiReply}"`);

        await MetaService.sendWhatsAppMessage(from, aiReply);
      }
    }

    // Handle status updates (delivered, read, etc.)
    const statuses = value?.statuses;
    if (statuses && statuses.length > 0) {
      const status = statuses[0];
      console.log(`📊 Message to ${status.recipient_id}: ${status.status}`);
    }
  } catch (error: any) {
    console.error('❌ Error processing WhatsApp webhook:', error.message);
  }
});

// ============================================================
// Contact Form Webhook (POST)
// ============================================================
router.post('/contact-form', async (req: Request, res: Response) => {
  const { name, phone, message } = req.body;

  if (!phone) {
    res.status(400).json({ error: 'Phone number is required' });
    return;
  }

  // CHECK IF BOT IS ACTIVE
  if (!ConfigService.isBotActive()) {
    console.log('⏸️  Bot is deactivated — ignoring contact form trigger');
    res.status(200).json({ success: false, message: 'Bot is currently deactivated' });
    return;
  }

  console.log(`📋 Contact form received — Name: ${name}, Phone: ${phone}`);
  res.status(200).json({ success: true, message: 'Automation triggered' });

  try {
    const welcomeMsg = `Hey ${name || 'there'}, thanks for reaching out to Global Peace Overseas! 🌍\nWe'll get back to you shortly.`;
    await MetaService.sendWhatsAppMessage(phone, welcomeMsg);

    if (message && message.trim()) {
      const aiReply = await AIService.generateReply(phone, message);
      await MetaService.sendWhatsAppMessage(phone, aiReply);
    }
  } catch (error: any) {
    console.error('❌ Error processing contact form:', error.message);
  }
});

export default router;

# AI Customer Automation Backend

This Node.js backend handles automated AI replies for WhatsApp using Google Gemini. It is designed to be hosted for free on a platform like Render.com and runs 24/7.

## Setup Instructions

### 1. Database
This app requires a MySQL database to store conversation history.
1. Create a MySQL database (e.g., in phpMyAdmin).
2. The app will automatically create a `chat_history` table upon startup if it connects successfully.

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

#### Google Gemini API
- Get your free API key from [Google AI Studio](https://aistudio.google.com/).

#### Meta Setup (WhatsApp)
1. Go to the [Meta for Developers Dashboard](https://developers.facebook.com/).
2. Create an App.
3. Add the **WhatsApp** product to your app.
4. Generate a permanent System User Access Token for your business portfolio, or use the temporary tokens provided in the dashboard for testing.
5. Provide a custom string for `META_VERIFY_TOKEN` (e.g., `my_secret_token_123`) in your `.env`.

### 3. Running Locally
```bash
npm install
npm run dev
```

Your server will run on `http://localhost:3000`. 
To expose it to the internet for Meta to send webhooks to, use ngrok:
```bash
ngrok http 3000
```
Use the provided `https://xyz.ngrok-free.app` URL for the next step.

### 4. Configuring Webhooks in Meta
- **WhatsApp:** Go to WhatsApp > Configuration. Set the callback URL to `https://<your-domain>/api/webhooks/whatsapp` and the verify token to your `META_VERIFY_TOKEN`.

### 5. Website Contact Form Trigger
To trigger the AI when a user fills a form on your PHP website, your PHP backend needs to send an HTTP POST request to:
`https://<your-domain>/api/webhooks/contact-form`

Payload:
```json
{
  "name": "User Name",
  "phone": "1234567890",
  "message": "I need help with pricing."
}
```

### 6. Hosting 24/7 on Render.com for Free
1. Push this code to a GitHub repository.
2. Go to [Render.com](https://render.com) and create a **Web Service** connected to your repo.
3. Set the build command to `npm install && npm run build`.
4. Set the start command to `npm start`.
5. Add all the Environment Variables from your `.env` file.
6. **Keep-Alive (Prevent Sleep):**
   - Render's free tier spins down after 15 minutes of inactivity.
   - Go to [cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/).
   - Set up a free monitor to ping `https://<your-render-url>/ping` every 14 minutes. This will keep the app awake 24/7 for free.

/**
 * Vercel serverless endpoint: POST /api/telegram
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the server environment
 * (Project Settings → Environment Variables on Vercel) and forwards one
 * nicely formatted message to the bot. Nothing here is ever shipped to the
 * browser — the React app only knows the path "/api/telegram".
 */
import { handleTelegramRequest } from "../server/telegram";

export default handleTelegramRequest;

/**
 * Vercel serverless endpoint: POST /api/telegram
 *
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the server environment
 * (Project Settings → Environment Variables on Vercel) and forwards one
 * nicely formatted message to the bot. Nothing here is ever shipped to the
 * browser — the React app only knows the path "/api/telegram".
 */
// Explicit ".js" extension: Node16/NodeNext-style resolution (used by the
// production runtime) refuses extensionless relative imports, which is what
// caused the 500 on POST /api/telegram in production.
import { handleTelegramRequest } from "../server/telegram.js";

export default handleTelegramRequest;

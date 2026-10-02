import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { handleTelegramRequest, type TelegramEnv } from "./server/telegram";

/**
 * Serves the same POST /api/telegram endpoint locally that Vercel serves in
 * production, so the story can be tested end-to-end without deploying.
 * The token and chat id come from .env and stay inside this process.
 */
function localTelegramApi(env: TelegramEnv): Plugin {
  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    void handleTelegramRequest(req, res, env);
  };

  return {
    name: "local-telegram-api",
    configureServer(server) {
      server.middlewares.use("/api/telegram", handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/telegram", handle);
    },
  };
}

export default defineConfig(({ mode }) => {
  // Read .env on the server side only — Vite never exposes non-VITE_ vars to
  // the client, and this object is never referenced by anything in src/.
  const serverEnv = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), localTelegramApi(serverEnv)],
    server: {
      host: true,
      open: true,
    },
  };
});

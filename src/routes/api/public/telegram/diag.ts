import { createFileRoute } from "@tanstack/react-router";
import { getWorkerRuntime } from "@/lib/worker-runtime";

const TG_API = "https://api.telegram.org";

export const Route = createFileRoute("/api/public/telegram/diag")({
  server: {
    handlers: {
      GET: async () => {
        const runtime = getWorkerRuntime();

        const secrets = {
          TELEGRAM_BOT_TOKEN: Boolean(runtime.botToken),
          TELEGRAM_WEBHOOK_SECRET: Boolean(runtime.telegramWebhookSecret),
          SUPABASE_URL: Boolean(runtime.supabaseUrl),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(runtime.supabaseServiceKey),
          MINI_APP_URL: Boolean(runtime.miniAppUrl),
          ADMIN_ID: Boolean(runtime.telegramAdminIds),
        };

        let webhookInfo: unknown = "skipped: no bot token configured";
        if (runtime.botToken) {
          try {
            const res = await fetch(`${TG_API}/bot${runtime.botToken}/getWebhookInfo`);
            webhookInfo = await res.json();
          } catch (error) {
            webhookInfo = { error: error instanceof Error ? error.message : String(error) };
          }
        }

        return Response.json({ secrets, webhookInfo });
      },
    },
  },
});

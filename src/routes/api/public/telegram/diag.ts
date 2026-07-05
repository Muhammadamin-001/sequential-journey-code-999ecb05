import { createFileRoute } from "@tanstack/react-router";
import { getWorkerRuntime } from "@/lib/worker-runtime";

const TG_API = "https://api.telegram.org";

export const Route = createFileRoute("/api/public/telegram/diag")({
  server: {
    handlers: {
      GET: async () => {
        const runtime = getWorkerRuntime();
        // Faqat CRON_SECRET/DIAG_SECRET bilan kirish mumkin.
        // (Ideal holatda buni butunlay dev-only qilib qoldirish kerak.)
        const secrets = {
          TELEGRAM_BOT_TOKEN: Boolean(runtime.botToken),
          TELEGRAM_WEBHOOK_SECRET: Boolean(runtime.telegramWebhookSecret),
          SUPABASE_URL: Boolean(runtime.supabaseUrl),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(runtime.supabaseServiceKey),
          MINI_APP_URL: Boolean(runtime.miniAppUrl),
          ADMIN_ID: Boolean(runtime.telegramAdminIds),
        };

        // Sirlarni ochmasdan, faqat server (Worker secret) va client
        // (build vaqtidagi VITE_SUPABASE_URL) bir xil Supabase loyihasiga
        // ishora qilishini tasdiqlaymiz. "unrecognized JWT kid" xatosining
        // eng ko'p tarqalgan sababi shu ikkisining mos kelmasligi.
        const projectCheck = {
          mismatchDetected: runtime.projectMismatch,
          note: runtime.projectMismatch
            ? "MISMATCH: Cloudflare Worker SUPABASE_URL secret does not match the VITE_SUPABASE_URL baked into the client build. Fix this first."
            : "OK: server and client point to the same Supabase project.",
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

        return Response.json({ secrets, projectCheck, webhookInfo });
      },
    },
  },
});

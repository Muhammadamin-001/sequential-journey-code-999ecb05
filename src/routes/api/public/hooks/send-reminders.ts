import { createFileRoute } from "@tanstack/react-router";
import { getWorkerRuntime } from "@/lib/worker-runtime";

const TG_API = "https://api.telegram.org";

function miniAppButton() {
  const url = getWorkerRuntime().miniAppUrl;
  if (!url) return undefined;
  return {
    inline_keyboard: [[{ text: "📱 Ilovani ochish", web_app: { url } }]],
  };
}

async function tgSend(chatId: number, text: string) {
  const token = getWorkerRuntime().botToken;
  if (!token) return;
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    const rm = miniAppButton();
    if (rm) body.reply_markup = rm;
    await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error("tg send failed", e);
  }
}

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = getWorkerRuntime().env.CRON_SECRET;
        if (!expected || request.headers.get("X-Cron-Secret") !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const nowIso = new Date().toISOString();

        const { data: tasks, error } = await supabaseAdmin
          .from("tasks")
          .select("id,user_id,title,description,deadline_at,reminder_at")
          .not("reminder_at", "is", null)
          .lte("reminder_at", nowIso)
          .neq("status", "completed");

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        if (!tasks || tasks.length === 0) {
          return Response.json({ ok: true, sent: 0 });
        }

        const userIds = Array.from(new Set(tasks.map((t) => t.user_id)));
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id,telegram_id")
          .in("id", userIds);

        const chatMap = new Map<string, number>();
        for (const p of profiles ?? []) {
          if (p.telegram_id) chatMap.set(p.id, Number(p.telegram_id));
        }

        let sent = 0;
        for (const t of tasks) {
          const chatId = chatMap.get(t.user_id);
          if (chatId) {
            const deadline = t.deadline_at
              ? `\n⏰ ${new Date(t.deadline_at).toLocaleString("uz-UZ")}`
              : "";
            const desc = t.description ? `\n${t.description}` : "";
            await tgSend(
              chatId,
              `🔔 <b>Eslatma</b>\n\n${t.title}${desc}${deadline}`,
            );
            sent++;
          }

          await supabaseAdmin.from("notifications").insert({
            user_id: t.user_id,
            title: "Eslatma",
            body: t.title,
            type: "reminder",
          });
        }

        await supabaseAdmin
          .from("tasks")
          .update({ reminder_at: null })
          .in("id", tasks.map((t) => t.id));

        return Response.json({ ok: true, sent, processed: tasks.length });
      },
    },
  },
});

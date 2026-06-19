import { createFileRoute } from "@tanstack/react-router";

const TG_API = "https://api.telegram.org";

async function tgSend(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TG_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (e) {
    console.error("tg send failed", e);
  }
}

export const Route = createFileRoute("/api/public/hooks/send-reminders")({
  server: {
    handlers: {
      POST: async () => {
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

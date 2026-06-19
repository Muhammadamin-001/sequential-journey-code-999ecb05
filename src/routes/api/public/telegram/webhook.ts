import { createFileRoute } from "@tanstack/react-router";

const TG_API = "https://api.telegram.org";

async function tgSend(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return res.ok;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
          return new Response("Not configured", { status: 500 });
        }

        // Optional: verify Telegram secret_token header
        const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (expectedSecret) {
          const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
          if (got !== expectedSecret) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        const update = await request.json();
        const message = update.message ?? update.edited_message;
        if (!message?.chat?.id) {
          return Response.json({ ok: true, ignored: true });
        }

        const chatId: number = message.chat.id;
        const fromUsername: string | undefined = message.from?.username;
        const text: string = message.text ?? "";

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        if (text.startsWith("/start") || text.startsWith("/link")) {
          if (!fromUsername) {
            await tgSend(
              chatId,
              "❌ Telegram username sozlanmagan. Avval Telegram sozlamalaridan username qo'shing.",
            );
            return Response.json({ ok: true });
          }

          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id,full_name")
            .ilike("telegram_username", fromUsername)
            .maybeSingle();

          if (!profile) {
            await tgSend(
              chatId,
              `👋 Salom @${fromUsername}!\n\nVazifa ilovasida hisobingiz topilmadi. Iltimos, avval ilovaga kiring va <b>Sozlamalar → Telegram username</b> bo'limiga <code>${fromUsername}</code> ni kiriting.`,
            );
            return Response.json({ ok: true });
          }

          await supabaseAdmin
            .from("profiles")
            .update({ telegram_id: chatId })
            .eq("id", profile.id);

          await supabaseAdmin.from("notifications").insert({
            user_id: profile.id,
            title: "Telegram ulandi",
            body: "Endi eslatmalarni Telegram orqali olasiz.",
            type: "info",
          });

          await tgSend(
            chatId,
            `✅ <b>${profile.full_name ?? fromUsername}</b>, hisobingiz ulandi!\n\nEndi vazifa eslatmalari shu yerga keladi.`,
          );
          return Response.json({ ok: true, linked: true });
        }

        if (text.startsWith("/help")) {
          await tgSend(
            chatId,
            "<b>Vazifa Bot</b>\n\n/start — hisobingizni ulash\n/help — yordam",
          );
        }

        return Response.json({ ok: true });
      },
    },
  },
});

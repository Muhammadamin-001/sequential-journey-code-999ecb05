import { createFileRoute } from "@tanstack/react-router";
import { getWorkerRuntime } from "@/lib/worker-runtime";

const TG_API = "https://api.telegram.org";
const TELEGRAM_PATH_TOKEN_HEADER = "X-Internal-Telegram-Path-Token";
const TELEGRAM_ENV_DIAG_HEADER = "X-Internal-Env-Diag";

type TelegramFrom = {
  id?: number;
  username?: string;
  first_name?: string;
};

type TelegramMessage = {
  chat?: { id?: number };
  from?: TelegramFrom;
  text?: string;
};

type TelegramCallbackQuery = {
  id?: string;
  data?: string;
  from?: TelegramFrom;
  message?: TelegramMessage;
};

type TelegramUpdate = {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

function getMiniAppUrl(): string | null {
  return getWorkerRuntime().miniAppUrl || null;
}

function normalizeHttpsUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
function appButton(fallbackUrl?: string, text = "📱 Ilovani ochish") {
  const configuredUrl = getMiniAppUrl();
  const url = normalizeHttpsUrl(configuredUrl) ?? normalizeHttpsUrl(fallbackUrl);
  if (!url) {
    if (configuredUrl || fallbackUrl) {
      console.error(
        `[Telegram webhook] Ignoring invalid MINI_APP_URL/fallback URL. Telegram web_app buttons require an absolute HTTPS URL.`,
      );
    }
    return undefined;
  }
  // WebApp button only works over HTTPS. Telegram opens it inside Telegram.
  return {
    inline_keyboard: [[{ text, web_app: { url } }]],
  };
}

async function tgSendWithToken(
  token: string | undefined,
  chatId: number,
  text: string,
  withButton = false,
  replyMarkup?: Record<string, unknown>,
  fallbackAppUrl?: string,
) {
  if (!token) return false;
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    // Telegram pre-fetches plain URLs in message text to build a link preview.
    // Our auto-login links are single-use magic-link tokens, so that pre-fetch
    // silently burns the token before the user ever taps it, causing
    // "Email link is invalid or has expired". Disabling the preview stops
    // Telegram from touching the URL at all.
    link_preview_options: { is_disabled: true },
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  } else if (withButton) {
    const rm = appButton(fallbackAppUrl);
    if (rm) body.reply_markup = rm;
  }
  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function tgSend(
  chatId: number,
  text: string,
  withButton = false,
  replyMarkup?: Record<string, unknown>,
  fallbackAppUrl?: string,
) {
  return tgSendWithToken(
    getWorkerRuntime().botToken,
    chatId,
    text,
    withButton,
    replyMarkup,
    fallbackAppUrl,
  );
}

function startKeyboard(request: Request) {
  const url = normalizeHttpsUrl(appLinkText(request));
  const button = url
    ? { text: "🔗 Hozirgi havola", web_app: { url } }
    : { text: "🔗 Hozirgi havola" };
  return {
    keyboard: [[button]],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function appLinkText(request: Request) {
  const appUrl =
    normalizeHttpsUrl(getMiniAppUrl()) ?? normalizeHttpsUrl(new URL("/", request.url).toString());
  return appUrl ?? "https://example.com";
}

function appLinkKeyboard(request: Request) {
  return appButton(appLinkText(request), "App");
}

function emailForChat(chatId: number) {
  return `tg${chatId}@telegram.local`;
}

function randomTelegramPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function adminIds(): Set<string> {
  return new Set(
    (getWorkerRuntime().telegramAdminIds ?? "")
      .split(/[\s,;]+/)
      .map((id) => id.trim())
      .filter(Boolean),
  );
}

function isAdminChat(chatId: number) {
  return adminIds().has(String(chatId));
}

function loginText(chatId: number, password: string, tgUser?: string | null) {
  const usernameLogin = tgUser ? `<code>${tgUser}</code> yoki ` : "";
  return `🌐 <b>Tizimga kirish uchun:</b>

Login: ${usernameLogin}user_id <code>${chatId}</code>
Parol: <code>${password}</code>`;
}

function consentKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "✅ Ruxsat beraman", callback_data: "consent:yes" },
        { text: "❌ Yo'q", callback_data: "consent:no" },
      ],
    ],
  };
}

function retryKeyboard() {
  return {
    inline_keyboard: [[{ text: "🔄 Qayta so'rov", callback_data: "consent:retry" }]],
  };
}

function consentText(firstName?: string) {
  return `👋 Salom${firstName ? ", <b>" + firstName + "</b>" : ""}!

Vazifa Tizimi xizmatidan foydalanish uchun Telegram profilingizdagi asosiy ma'lumotlar (Telegram ID, ism va username) Supabase bazasida saqlanishiga ruxsat bering.

Ruxsat bersangiz, ro'yxatdan o'tishni Telegram ichida davom ettiramiz.`;
}

async function answerCallback(callbackQueryId: string, token = getWorkerRuntime().botToken) {
  if (!token) return false;
  const res = await fetch(`${TG_API}/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
  return res.ok;
}

function envDiagnostics(request: Request) {
  const runtime = getWorkerRuntime();
  const workerDiag = request.headers.get(TELEGRAM_ENV_DIAG_HEADER);

  return `Diag: v4 runtime_url=${runtime.supabaseUrl ? "yes" : "no"} runtime_service=${runtime.supabaseServiceKey ? "yes" : "no"} worker=${workerDiag ?? "none"}`;
}

function publicProvisioningError(error: unknown, request: Request) {
  const message = error instanceof Error ? error.message : String(error);
  const diag = envDiagnostics(request);

  if (message.includes("Missing Supabase environment variable")) {
    return `${message} Cloudflare Worker secrets ichida SUPABASE_URL yoki VITE_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY borligini tekshiring.\n\n${diag}`;
  }

  if (message.includes("telegram_pending_registrations")) {
    return `Supabase migration ishlatilmagan: telegram_pending_registrations jadvali topilmadi.\n\n${diag}`;
  }

  if (message.includes("profiles") || message.includes("user_roles")) {
    return `Supabase migration yoki profile trigger sozlamalarida muammo bor. profiles va user_roles jadvallarini tekshiring.\n\n${diag}`;
  }

  return `Supabase admin so'rovi bajarilmadi. Cloudflare logs ichidagi aniq xatoni tekshiring.\n\n${diag}`;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const runtime = getWorkerRuntime();
        const token =
          runtime.botToken ?? request.headers.get(TELEGRAM_PATH_TOKEN_HEADER) ?? undefined;
        if (!token) {
          console.error("[Telegram webhook] Missing TELEGRAM_BOT_TOKEN secret.");
          return Response.json({ ok: true, configured: false, error: "missing_bot_token" });
        }
        let chatId: number | undefined;
        const send = (
          targetChatId: number,
          text: string,
          withButton = false,
          replyMarkup?: Record<string, unknown>,
          fallbackAppUrl?: string,
        ) => tgSendWithToken(token, targetChatId, text, withButton, replyMarkup, fallbackAppUrl);
        try {
          const expectedSecret = runtime.telegramWebhookSecret;
          if (expectedSecret) {
            const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
            if (got !== expectedSecret) {
              return new Response("Unauthorized", { status: 401 });
            }
          }

          let update: TelegramUpdate;
          try {
            update = (await request.json()) as TelegramUpdate;
          } catch {
            return Response.json({ ok: true, ignored: "invalid_json" });
          }
          const callbackQuery = update.callback_query;
          const message = update.message ?? update.edited_message ?? callbackQuery?.message;
          if (!message?.chat?.id) return Response.json({ ok: true, ignored: true });

          chatId = message.chat.id;
          const from = callbackQuery?.from ?? message.from;
          const fromUsername: string | undefined = from?.username;
          const fromFirstName: string | undefined = from?.first_name;
          const text: string = (message.text ?? "").trim();
          const callbackData: string | undefined = callbackQuery?.data;

          if (callbackQuery?.id) await answerCallback(callbackQuery.id, token);

          if (callbackData === "app:link" || text === "🔗 Hozirgi havola") {
            const appUrl = appLinkText(request);
            await send(chatId, appUrl, false, appLinkKeyboard(request));
            return Response.json({ ok: true });
          }


          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // ---------- Helpers ----------
          const linkedProfile = async () => {
            const { data } = await supabaseAdmin
              .from("profiles")
              .select("id,full_name,telegram_username")
              .eq("telegram_id", chatId)
              .maybeSingle();
            return data;
          };

          const provisionTelegramUser = async (fullName?: string | null) => {
            const email = emailForChat(chatId);
            const displayName = fullName || fromFirstName || fromUsername || `user${chatId}`;
            const tgUser = fromUsername ?? null;

            const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
            if (listErr) throw listErr;
            const existingUser = userList.users.find((user) => user.email === email);
            let userId = existingUser?.id;
            const created = !userId;

            if (userId) {
              const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                email_confirm: true,
                user_metadata: { full_name: displayName },
              });
              if (updateErr) throw updateErr;
            } else {
              // No password is set here on purpose: login now happens exclusively
              // through the auto-login link sent below, never a typed password.
              const { data: createdUser, error: createErr } =
                await supabaseAdmin.auth.admin.createUser({
                  email,
                  email_confirm: true,
                  user_metadata: { full_name: displayName },
                });
              if (createErr) throw createErr;
              userId = createdUser.user?.id;
            }

            if (!userId) throw new Error("Supabase user yaratilmadi");

            const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
              id: userId,
              telegram_id: chatId,
              telegram_username: tgUser,
              full_name: displayName,
            });
            if (profileErr) throw profileErr;

            if (isAdminChat(chatId)) {
              await supabaseAdmin
                .from("user_roles")
                .delete()
                .eq("user_id", userId)
                .neq("role", "admin");
              await supabaseAdmin
                .from("user_roles")
                .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
            }

            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("id,full_name,telegram_username")
              .eq("id", userId)
              .maybeSingle();

            return {
              profile: profile ?? { id: userId, full_name: displayName, telegram_username: tgUser },
              created,
              email,
              tgUser,
            };
          };

          // Generates a one-time Supabase magic-link token and turns it into a URL
          // pointing at our own /auth-callback page, which calls verifyOtp() and
          // signs the user in automatically — no login/password typing required.
          const buildAutoLoginUrl = async (email: string) => {
            const { data, error } = await supabaseAdmin.auth.admin.generateLink({
              type: "magiclink",
              email,
            });
            const hashedToken = data?.properties?.hashed_token;
            if (error || !hashedToken) {
              throw error ?? new Error("Kirish havolasi yaratilmadi");
            }
            const url = new URL("auth-callback", appLinkText(request));
            url.searchParams.set("token_hash", hashedToken);
            url.searchParams.set("type", "magiclink");
            return url.toString();
          };

          if (text === "/start") {
            try {
              const { profile, created, email } = await provisionTelegramUser();
              await supabaseAdmin
                .from("telegram_pending_registrations")
                .delete()
                .eq("chat_id", chatId);
              const autoLoginUrl = await buildAutoLoginUrl(email);
              await send(
                chatId,
                `👋 Salom, <b>${profile.full_name ?? fromFirstName ?? "do'st"}</b>!\n\n${created ? "✅ Hisobingiz yaratildi." : "✅ Hisobingiz allaqachon faol."}${isAdminChat(chatId) ? "\n\n🛡 Sizga admin huquqi berildi." : ""}\n\n🌐 <b>Ilovaga kirish:</b>\n${autoLoginUrl}\n\nLogin yoki parol kiritish shart emas — havola (yoki pastdagi tugma) orqali avtomatik kirasiz.`,
                false,
                { inline_keyboard: [[{ text: "📱 Ilovani ochish", web_app: { url: autoLoginUrl } }]] },
              );
            } catch (error) {
              console.error(error);
              await send(
                chatId,
                `❌ /start vaqtida hisob yaratishda xatolik: ${publicProvisioningError(error, request)}`,
              );
            }
            return Response.json({ ok: true });
          }

          if (text === "/resetpassword") {
            try {
              const email = emailForChat(chatId);
              const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
              if (listErr) throw listErr;
              const existingUser = userList.users.find((user) => user.email === email);
              if (!existingUser) {
                await send(chatId, "❌ Hisobingiz topilmadi. Avval /start yuboring.");
                return Response.json({ ok: true });
              }
              const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
                existingUser.id,
                { password: randomTelegramPassword() },
              );
              if (updateErr) throw updateErr;
              await send(
                chatId,
                "🔑 Xavfsizlik ma'lumotlaringiz yangilandi.\n\nIlovaga kirish uchun /start buyrug'ini yuboring — u orqali keladigan havola sizni login/parolsiz avtomatik tizimga kiritadi.",
              );
            } catch (error) {
              console.error(error);
              await send(
                chatId,
                `❌ Xatolik: ${publicProvisioningError(error, request)}`,
              );
            }
            return Response.json({ ok: true });
          }


          // ---------- Consent callbacks ----------
          if (callbackData === "consent:retry") {
            await send(chatId, consentText(fromFirstName), false, consentKeyboard());
            return Response.json({ ok: true });
          }
          if (callbackData === "consent:no") {
            await supabaseAdmin
              .from("telegram_pending_registrations")
              .delete()
              .eq("chat_id", chatId);
            await send(
              chatId,
              `ℹ️ Xizmatdan foydalanish uchun Telegram ID, ism va username kabi ma'lumotlar ro'yxatdan o'tish va bildirishnomalarni yuborish uchun kerak bo'ladi. Rozilik bermasangiz, bot orqali ro'yxatdan o'tish davom etmaydi.

Fikringiz o'zgarsa, pastdagi tugma orqali so'rovni qayta oching.`,
              false,
              retryKeyboard(),
            );

            return Response.json({ ok: true });
          }

          if (callbackData === "consent:yes") {
            const existing = await linkedProfile();
            if (existing) {
              await send(
                chatId,
                "✅ Sizning ma'lumotlaringiz allaqachon saqlangan va hisobingiz ulangan. Ilovani ochish uchun pastdagi tugmani bosing.",
                true,
              );
              return Response.json({ ok: true });
            }
            await supabaseAdmin.from("telegram_pending_registrations").upsert(
              {
                chat_id: chatId,
                telegram_username: fromUsername ?? null,
                step: "await_name",
                full_name: fromFirstName ?? null,
              },
              { onConflict: "chat_id" },
            );
            await send(
              chatId,
              `✅ Ruxsat qabul qilindi va Telegram ma'lumotlaringiz ro'yxatdan o'tish uchun saqlandi.

📝 1/2: Iltimos, to'liq ismingizni yuboring.

Bekor qilish: /cancel`,
            );
            return Response.json({ ok: true });
          }

          if (callbackData) return Response.json({ ok: true, ignored: true });

          // ---------- Commands ----------
          if (text === "/help" || text === "/register") {
            try {
              const { profile, created, email } = await provisionTelegramUser();
              await supabaseAdmin
                .from("telegram_pending_registrations")
                .delete()
                .eq("chat_id", chatId);
              const autoLoginUrl = await buildAutoLoginUrl(email);
              await send(
                chatId,
                `👋 Salom, <b>${profile.full_name ?? fromFirstName ?? "do'st"}</b>!\n\n${created ? "✅ Hisobingiz yaratildi va web ilova bilan ulandi." : "✅ Hisobingiz web ilova bilan ulangan."}${isAdminChat(chatId) ? "\n\n🛡 Sizga admin huquqi berildi." : ""}\n\n🌐 <b>Ilovaga kirish:</b>\n${autoLoginUrl}\n\nLogin yoki parol kiritish shart emas — havola (yoki pastdagi tugma) orqali avtomatik kirasiz.`,
                false,
                { inline_keyboard: [[{ text: "📱 Ilovani ochish", web_app: { url: autoLoginUrl } }]] },
              );
            } catch (error) {
              console.error(error);
              await send(
                chatId,
                `❌ Hisob yaratishda xatolik: ${publicProvisioningError(error, request)}`,
              );
            }
            return Response.json({ ok: true });
          }

          if (text === "/cancel") {
            await supabaseAdmin
              .from("telegram_pending_registrations")
              .delete()
              .eq("chat_id", chatId);
            await send(chatId, "❌ Bekor qilindi. /start");
            return Response.json({ ok: true });
          }
          if (text === "/link") {
            if (!fromUsername) {
              await send(
                chatId,
                "❌ Telegram username sozlanmagan. Sozlamalardan username qo'shing.",
              );
              return Response.json({ ok: true });
            }
            const { data: profile } = await supabaseAdmin
              .from("profiles")
              .select("id,full_name")
              .ilike("telegram_username", fromUsername)
              .maybeSingle();
            if (!profile) {
              await send(
                chatId,
                `❌ Web hisobingizda <code>${fromUsername}</code> username topilmadi. Web ilovaga kiring va Sozlamalar → Telegram username qatoriga shu username'ni kiriting. Yoki /register orqali yangi hisob oching.`,
              );
              return Response.json({ ok: true });
            }
            await supabaseAdmin
              .from("profiles")
              .update({ telegram_id: chatId })
              .eq("id", profile.id);
            await send(
              chatId,
              `✅ <b>${profile.full_name ?? fromUsername}</b>, hisobingiz ulandi!`,
              true,
            );
            return Response.json({ ok: true });
          }
          // ---------- Multi-step registration ----------
          const { data: pending } = await supabaseAdmin
            .from("telegram_pending_registrations")
            .select("step,full_name,telegram_username")
            .eq("chat_id", chatId)
            .maybeSingle();

          if (pending?.step === "await_name") {
            const name = text.slice(0, 80);
            if (name.length < 2 || name.startsWith("/")) {
              await send(chatId, "❌ Ism kamida 2 belgi bo'lsin. Qayta yuboring.");
              return Response.json({ ok: true });
            }
            await supabaseAdmin
              .from("telegram_pending_registrations")
              .update({ full_name: name, step: "await_password" })
              .eq("chat_id", chatId);
            await send(
              chatId,
              "🔐 2/2: Endi <b>parol</b> tanlang (kamida 6 belgi). Bu parol bilan web saytga ham kira olasiz.\n\nBekor qilish: /cancel",
            );
            return Response.json({ ok: true });
          }

          if (pending?.step === "await_password") {
            const password = text;
            if (password.length < 6 || password.startsWith("/")) {
              await send(chatId, "❌ Parol kamida 6 belgi bo'lsin. Qayta yuboring.");
              return Response.json({ ok: true });
            }

            const email = emailForChat(chatId);
            const fullName = pending.full_name ?? fromFirstName ?? `user${chatId}`;
            const tgUser = pending.telegram_username ?? fromUsername ?? null;

            try {
              const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
              if (listErr) throw listErr;

              const existingUser = userList.users.find((user) => user.email === email);
              let userId = existingUser?.id;
              let createdAccount = false;

              if (userId) {
                const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
                  password,
                  email_confirm: true,
                  user_metadata: { full_name: fullName },
                });
                if (updateErr) throw updateErr;
              } else {
                const { data: created, error: createErr } =
                  await supabaseAdmin.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { full_name: fullName },
                  });
                if (createErr) throw createErr;
                userId = created.user?.id;
                createdAccount = true;
              }

              if (!userId) throw new Error("Supabase user yaratilmadi");

              // Profile is usually auto-created by handle_new_user trigger, but upsert here
              // guarantees that Telegram registration always finishes with a usable login code.
              const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
                id: userId,
                telegram_id: chatId,
                telegram_username: tgUser,
                full_name: fullName,
              });
              if (profileErr) throw profileErr;

              if (isAdminChat(chatId)) {
                await supabaseAdmin
                  .from("user_roles")
                  .delete()
                  .eq("user_id", userId)
                  .neq("role", "admin");
                const { error: roleErr } = await supabaseAdmin
                  .from("user_roles")
                  .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
                if (roleErr) throw roleErr;
              }


              await supabaseAdmin
                .from("telegram_pending_registrations")
                .delete()
                .eq("chat_id", chatId);

              await send(
                chatId,
                `✅ <b>Tabriklaymiz, ${fullName}!</b>\n\n${createdAccount ? "Hisobingiz yaratildi" : "Mavjud hisobingiz yangilandi"} va botga ulandi.\n\n🔑 <b>Sizning kodingiz:</b> <code>tg${chatId}</code>\n\n🌐 <b>Web saytga kirish:</b>\n• Login (username): <code>tg${chatId}</code>${tgUser ? " yoki <code>" + tgUser + "</code>" : ""}\n• Parol: o'zingiz tanlagan parol${isAdminChat(chatId) ? "\n\n🛡 Sizga admin huquqi berildi." : ""}\n\nIlovani Telegramda ochish uchun pastdagi tugmani bosing 👇`,
                true,
                undefined,
                new URL("/", request.url).toString(),
              );
            } catch (error) {
              console.error(error);
              await send(
                chatId,
                `❌ Ro'yxatdan o'tishda xatolik: ${publicProvisioningError(error, request)}\n\nQayta urinib ko'ring: /register`,
              );
            }
            return Response.json({ ok: true });
          }

          // Fallback
          await send(chatId, "Tushunmadim. Buyruqlar: /start /register /link /resetpassword /help");
          return Response.json({ ok: true });
        } catch (error) {
          console.error("[Telegram webhook] Unhandled error", error);
          if (chatId) {
            await send(
              chatId,
              `❌ Bot ichki xatolikka uchradi, lekin webhook 200 qaytardi. Tafsilot: ${publicProvisioningError(error, request)}`,
            ).catch((sendError) =>
              console.error("[Telegram webhook] Failed to send error message", sendError),
            );
          }
          return Response.json({ ok: true, handled: false, error: "internal_error" });
        }
      },
    },
  },
});
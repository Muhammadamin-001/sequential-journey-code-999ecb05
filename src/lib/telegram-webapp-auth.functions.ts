import { createServerFn } from "@tanstack/react-start";
import { getWorkerRuntime } from "@/lib/worker-runtime";

interface TelegramInitDataUser {
  id: number;
  first_name?: string;
  username?: string;
}

async function hmacSha256(rawKey: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    rawKey as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies Telegram's WebApp `initData` signature.
 * Algorithm per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *   secret_key = HMAC_SHA256(key = "WebAppData", data = bot_token)
 *   expected_hash = HMAC_SHA256(key = secret_key, data = data_check_string)
 * Only Telegram (which alone knows the bot token) could have produced a
 * matching hash, so a match proves the payload really came from Telegram
 * and wasn't tampered with — no password/PIN/link needed at all.
 */
async function verifyInitData(
  initData: string,
  botToken: string,
): Promise<TelegramInitDataUser | null> {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = Array.from(params.keys())
    .sort()
    .map((key) => `${key}=${params.get(key)}`)
    .join("\n");

  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  const computed = toHex(await hmacSha256(secretKey, dataCheckString));
  if (computed !== hash.toLowerCase()) return null;

  // Reject stale/replayed initData (Telegram refreshes auth_date on every open).
  const authDate = Number(params.get("auth_date") ?? 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 86400) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as TelegramInitDataUser;
    return typeof user.id === "number" ? user : null;
  } catch {
    return null;
  }
}

export const telegramWebAppSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: { initData: string }) => ({
    initData: String(data?.initData ?? ""),
  }))
  .handler(async ({ data }) => {
    const runtime = getWorkerRuntime();
    const botToken = runtime.botToken;
    if (!botToken) return { error: "Bot token sozlanmagan." };

    // Server (SUPABASE_URL secret) va client build (VITE_SUPABASE_URL)
    // boshqa-boshqa Supabase loyihasiga ishora qilsa, bu yerda darrov
    // to'xtatamiz — aks holda foydalanuvchi keyinroq tushunarsiz
    // "invalid JWT / unrecognized kid" xatosini ko'radi.
    if (runtime.projectMismatch) {
      return {
        error:
          "Server konfiguratsiyasi xato: Cloudflare Worker'dagi SUPABASE_URL " +
          "secret build vaqtidagi VITE_SUPABASE_URL bilan mos kelmaydi. " +
          "Cloudflare Worker sozlamalarida SUPABASE_URL va " +
          "SUPABASE_SERVICE_ROLE_KEY qiymatlarini to'g'ri loyihaga moslang.",
      };
    }

    const tgUser = await verifyInitData(data.initData, botToken);
    if (!tgUser) return { error: "Telegram ma'lumotlari tasdiqlanmadi." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const chatId = tgUser.id;
    const email = `tg${chatId}@telegram.local`;
    const displayName = tgUser.first_name || tgUser.username || `user${chatId}`;

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("telegram_id", chatId)
      .maybeSingle();

    let userId = existingProfile?.id;

    if (!userId) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: displayName },
      });
      if (createErr || !created.user) {
        return { error: createErr?.message ?? "Hisob yaratilmadi." };
      }
      userId = created.user.id;

      const { error: profileErr } = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        telegram_id: chatId,
        telegram_username: tgUser.username ?? null,
        full_name: displayName,
      });
      if (profileErr) return { error: profileErr.message };
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
        user_metadata: { full_name: displayName },
      });
    }

    // Mint a session server-side: generate a magic-link token and verify it
    // immediately, in the same request — the browser never sees the raw
    // single-use token, so there's no prefetch/double-fire race like before.
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      return { error: linkErr?.message ?? "Sessiya yaratilmadi." };
    }

    const { data: verifyData, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
      token_hash: tokenHash,
      type: "magiclink",
    });
    if (verifyErr || !verifyData.session) {
      return { error: verifyErr?.message ?? "Sessiya tasdiqlanmadi." };
    }

    return {
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
    };
  });

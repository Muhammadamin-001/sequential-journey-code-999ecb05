import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type WorkerEnv = Record<string, string | undefined>;

export type WorkerRuntime = {
  env: WorkerEnv;
  supabaseUrl: string | undefined;
  supabaseServiceKey: string | undefined;
  botToken: string | undefined;
  miniAppUrl: string | undefined;
  telegramAdminIds: string | undefined;
  telegramWebhookSecret: string | undefined;
  supabasePublishableKey: string | undefined;
  supabaseAdmin: ReturnType<typeof createClient<Database>> | undefined;
  projectMismatch: boolean;
};

declare global {
  var __WORKER_RUNTIME__: WorkerRuntime | undefined;
}

export function runtimeEnv(env: unknown): WorkerEnv {
  return typeof env === "object" && env !== null ? (env as WorkerEnv) : {};
}
// Supabase URL'dan loyiha ref'ini ("smsjbzbdaxgpzlakxdjv" kabi) ajratib oladi.
// Sirli ma'lumot emas — faqat qaysi loyihaga ulanilganini solishtirish uchun.
function extractSupabaseProjectRef(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname; // masalan: smsjbzbdaxgpzlakxdjv.supabase.co
    return host.split(".")[0];
  } catch {
    return undefined;
  }
}

export function initializeWorkerRuntime(config: {
  env: WorkerEnv;
  supabaseUrl: string | undefined;
  supabaseServiceKey: string | undefined;
  botToken: string | undefined;
}) {
  const { env, supabaseUrl, supabaseServiceKey, botToken } = config;
  // KRITIK TEKSHIRUV: agar Cloudflare Worker secret'idagi SUPABASE_URL
  // build vaqtida ishlatilgan VITE_SUPABASE_URL'dan farq qilsa, server
  // tokenlarni bir loyihada imzolaydi, client esa boshqa loyihada
  // tekshiradi -> "unrecognized JWT kid" xatosi shundan kelib chiqadi.
  // import.meta.env.VITE_* qiymatlari build vaqtida statik matn sifatida
  // ichga "quyiladi" (server bundle ham shu jumladan), shuning uchun bu
  // solishtirish runtime env o'qishga bog'liq emas.
  const buildTimeClientUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const serverRef = extractSupabaseProjectRef(supabaseUrl);
  const clientRef = extractSupabaseProjectRef(buildTimeClientUrl);
  if (serverRef && clientRef && serverRef !== clientRef) {
    console.error(
      `[Supabase] PROJECT MISMATCH: server SUPABASE_URL points to project ` +
        `"${serverRef}" but the client bundle was built with VITE_SUPABASE_URL ` +
        `for project "${clientRef}". Tokens minted by the admin client will ` +
        `NEVER validate on the client (JWT "unrecognized kid" errors). Fix the ` +
        `Cloudflare Worker secret SUPABASE_URL (and SUPABASE_SERVICE_ROLE_KEY) ` +
        `to match the "${clientRef}" project, or rebuild with VITE_SUPABASE_URL ` +
        `pointing at "${serverRef}".`,
    );
  }
  const supabaseAdmin =
    supabaseUrl && supabaseServiceKey
      ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : undefined;

  globalThis.__WORKER_RUNTIME__ = {
    env,
    supabaseUrl,
    supabaseServiceKey,
    botToken,
    miniAppUrl: env.MINI_APP_URL || env.VITE_MINI_APP_URL,
    telegramAdminIds: env.ADMIN_ID || env.TELEGRAM_ADMIN_ID,
    telegramWebhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    supabasePublishableKey:
      env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY,
    supabaseAdmin,
    projectMismatch: Boolean(serverRef && clientRef && serverRef !== clientRef),
  };
}

export function getWorkerRuntime() {
  const runtime = globalThis.__WORKER_RUNTIME__;
  if (!runtime) {
    throw new Error("Cloudflare Worker runtime environment is not initialized.");
  }
  return runtime;
}

export function getSupabaseAdminClient() {
  const runtime = getWorkerRuntime();
  if (!runtime.supabaseUrl || !runtime.supabaseServiceKey || !runtime.supabaseAdmin) {
    const missing = [
      ...(!runtime.supabaseUrl ? ["SUPABASE_URL"] : []),
      ...(!runtime.supabaseServiceKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    const message = `Missing Cloudflare Worker secret(s): ${missing.join(", ")}. Configure them in the Cloudflare Worker dashboard.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }
  return runtime.supabaseAdmin;
}

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
};

declare global {
  var __WORKER_RUNTIME__: WorkerRuntime | undefined;
}

export function runtimeEnv(env: unknown): WorkerEnv {
  return typeof env === "object" && env !== null ? (env as WorkerEnv) : {};
}

export function initializeWorkerRuntime(config: {
  env: WorkerEnv;
  supabaseUrl: string | undefined;
  supabaseServiceKey: string | undefined;
  botToken: string | undefined;
}) {
  const { env, supabaseUrl, supabaseServiceKey, botToken } = config;
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

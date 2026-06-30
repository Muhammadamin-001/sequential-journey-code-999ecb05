import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { initializeWorkerRuntime, runtimeEnv, type WorkerEnv } from "./lib/worker-runtime";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

const TELEGRAM_PATH_TOKEN_HEADER = "X-Internal-Telegram-Path-Token";
const TELEGRAM_ENV_DIAG_HEADER = "X-Internal-Env-Diag";
const TELEGRAM_TOKEN_PATH_RE = /^\d+:[A-Za-z0-9_-]{20,}$/;

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function maybeRewriteTelegramTokenWebhook(request: Request, env: WorkerEnv, botToken?: string): Request {
  if (request.method !== "POST") return request;

  const url = new URL(request.url);
  const normalizedPath = url.pathname.replace(/\/+$|^\/+/g, "");

  // Some Telegram bot hosting examples use /<BOT_TOKEN> as the webhook path.
  // Keep the canonical TanStack route working while accepting that deployment
  // style too, so existing Telegram setWebhook URLs do not 404.
  if (normalizedPath !== botToken && !TELEGRAM_TOKEN_PATH_RE.test(normalizedPath)) {
    return request;
  }

  url.pathname = "/api/public/telegram/webhook";
  const headers = new Headers(request.headers);
  headers.set(TELEGRAM_PATH_TOKEN_HEADER, normalizedPath);
  headers.set(
    TELEGRAM_ENV_DIAG_HEADER,
    JSON.stringify({
      workerSupabaseServiceRole: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      workerSupabaseUrl: Boolean(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL),
    }),
  );

  return new Request(url.toString(), {
    body: request.body,
    cf: request.cf,
    duplex: "half",
    headers,
    method: request.method,
    redirect: request.redirect,
    signal: request.signal,
  } as RequestInit & { cf?: unknown; duplex: "half" });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const workerEnv = runtimeEnv(env);
      const supabaseUrl = workerEnv.SUPABASE_URL || workerEnv.VITE_SUPABASE_URL;
      const supabaseServiceKey = workerEnv.SUPABASE_SERVICE_ROLE_KEY;
      const botToken = workerEnv.TELEGRAM_BOT_TOKEN;

      initializeWorkerRuntime({
        env: workerEnv,
        supabaseUrl,
        supabaseServiceKey,
        botToken,
      });

      const handler = await getServerEntry();
      const response = await handler.fetch(
        maybeRewriteTelegramTokenWebhook(request, workerEnv, botToken),
        env,
        ctx,
      );
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

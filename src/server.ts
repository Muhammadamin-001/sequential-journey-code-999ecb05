import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};
type RuntimeEnv = Record<string, string | undefined>;

declare global {
  var __WORKER_ENV__: RuntimeEnv | undefined;
}

const TELEGRAM_PATH_TOKEN_HEADER = "X-Internal-Telegram-Path-Token";
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

function runtimeEnv(env: unknown): RuntimeEnv {
  return typeof env === "object" && env !== null ? (env as RuntimeEnv) : {};
}

function applyRuntimeEnvToProcess(env: unknown) {
  const workerEnv = runtimeEnv(env);
  globalThis.__WORKER_ENV__ = workerEnv;

  for (const [key, value] of Object.entries(workerEnv)) {
    if (typeof value === "string" && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getTelegramBotToken(env: unknown): string | undefined {
  return runtimeEnv(env).TELEGRAM_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;
}

function maybeRewriteTelegramTokenWebhook(request: Request, env: unknown): Request {
  if (request.method !== "POST") return request;

  const token = getTelegramBotToken(env);
  const url = new URL(request.url);
  const normalizedPath = url.pathname.replace(/\/+$|^\/+/g, "");

  // Some Telegram bot hosting examples use /<BOT_TOKEN> as the webhook path.
  // Keep the canonical TanStack route working while accepting that deployment
  // style too, so existing Telegram setWebhook URLs do not 404.
  if (normalizedPath !== token && !TELEGRAM_TOKEN_PATH_RE.test(normalizedPath)) {
    return request;
  }

  url.pathname = "/api/public/telegram/webhook";
  const headers = new Headers(request.headers);
  headers.set(TELEGRAM_PATH_TOKEN_HEADER, normalizedPath);

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
      applyRuntimeEnvToProcess(env);
      const handler = await getServerEntry();
      const response = await handler.fetch(
        maybeRewriteTelegramTokenWebhook(request, env),
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserProfile } from "@/lib/auth-profile";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth-callback")({
  head: () => ({
    meta: [{ title: "Kirilmoqda… — Vazifa Tizimi" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Guards against the effect firing more than once (re-renders, an unstable
  // navigate() reference, StrictMode, etc). The magic-link token is single-use,
  // so a second verifyOtp() call for the same token always fails with
  // "invalid or expired" — even though the first call already succeeded.
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (!tokenHash || !type) {
        setError("Havola yaroqsiz. Botga qaytib /start yuboring.");
        return;
      }

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "magiclink" | "email",
      });

      if (verifyError || !data.user) {
        setError(
          verifyError?.message ??
            "Havola muddati o'tgan yoki allaqachon ishlatilgan. Botga qaytib /start yuboring.",
        );
        return;
      }

      try {
        await ensureUserProfile(data.user);
      } catch {
        // Non-fatal: profile trigger usually already handles this.
      }

      navigate({ to: "/dashboard" });
    };

    void run();
    // Intentionally empty: this must run exactly once, on mount, regardless
    // of whether `navigate` gets a new identity on later renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="aurora-bg flex min-h-screen items-center justify-center px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <Sparkles className="size-8 text-primary" />
        {error ? (
          <>
            <p className="max-w-sm text-sm text-destructive">{error}</p>
            <a href="/auth" className="text-sm text-primary underline underline-offset-4">
              Login sahifasiga o'tish
            </a>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Tizimga kirilmoqda…</p>
        )}
      </div>
    </main>
  );
}

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserProfile } from "@/lib/auth-profile";

function isInsideTelegramMiniApp() {
  return typeof window !== "undefined" && Boolean(window.Telegram?.WebApp?.initData);
}

// Telegram Mini App ichida __root.tsx fonda initData orqali login qilib
// bo'lguncha bir oz vaqt o'tadi (bir nechta ketma-ket server so'rovi).
// Agar shu payt himoyalangan sahifaga to'g'ridan-to'g'ri kirilsa, sessiya
// hali yo'q bo'lgani uchun quyidagi tekshiruv foydalanuvchini /auth'ga
// otib yuborardi. Shu sababli, Mini App ichida bo'lsak, sessiya paydo
// bo'lishini qisqa muddat kutamiz.
async function waitForSessionInsideMiniApp() {
  if (!isInsideTelegramMiniApp()) return;
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    await waitForSessionInsideMiniApp();

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    await ensureUserProfile(data.user);
    return { user: data.user };
  },
  component: () => <Outlet />,
});
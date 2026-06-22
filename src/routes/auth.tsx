import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ensureUserProfile } from "@/lib/auth-profile";
import { resolveLoginEmail } from "@/lib/auth-resolve.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Kirish — Vazifa Tizimi" },
      { name: "description", content: "Hisobingizga kiring yoki ro'yxatdan o'ting." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Support email, "tg<chatId>", or Telegram username.
    let loginEmail = email;
    if (!email.includes("@")) {
      try {
        const res = await resolveLoginEmail({ data: { login: email } });
        if (res.email) loginEmail = res.email;
      } catch {
        // fall through; supabase will return its own error
      }
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (!error && data.user) {
      const { error: profileError } = await ensureProfileSafely(data.user);
      if (profileError) {
        setLoading(false);
        return toast.error(`Profil yaratilmadi: ${profileError.message}`);
      }
    }
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Xush kelibsiz!");
    navigate({ to: "/dashboard" });
  };


  const ensureProfileSafely = async (user: User) => {
    try {
      await ensureUserProfile(user);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };


  return (
    <main className="aurora-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-foreground">
          <Sparkles className="size-6 text-primary" />
          <span className="font-display text-2xl font-bold">Vazifa</span>
        </Link>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Hisobingizga kiring</CardTitle>
            <CardDescription>Telegram bot orqali olingan login bilan tizimga kiring.</CardDescription>
          </CardHeader>
          <CardContent>
            

            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Kirish</TabsTrigger>
                <TabsTrigger value="signup">Yo'riqnoma</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email yoki Telegram username</Label>
                    <Input
                      id="email"
                      type="text"
                      required
                      placeholder="email@example.com yoki tg123456789"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ro'yxatdan o'tish Telegram bot orqali amalga oshiriladi. Bot bergan login (<code>tg…</code>) yoki Telegram username'ingizdan foydalaning.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Parol</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "..." : "Kirish"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <div className="space-y-4 pt-4 text-sm text-muted-foreground">
                  <p>
                    Yangi hisob ochish faqat Telegram bot orqali bajariladi. Botga kiring,
                    <code> /start</code> bosing, ma'lumotlardan foydalanishga ruxsat bering va ko'rsatmalar bo'yicha parol yarating.
                  </p>
                  <p>
                    Ro'yxatdan o'tish tugagach, bot bergan <code>tg…</code> login yoki Telegram username orqali shu sahifadan kiring.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, Sparkles, CheckCircle2, Clock, ListTodo, Folder } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Boshqaruv paneli — Vazifa" }],
  }),
  component: Dashboard,
});

type Profile = { full_name: string | null };

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ total: 0, done: 0, pending: 0, sections: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: prof }, { count: total }, { count: done }, { count: pending }, { count: sectionsCount }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
        supabase.from("tasks").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending"),
        supabase.from("sections").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      setProfile(prof);
      setStats({
        total: total ?? 0,
        done: done ?? 0,
        pending: pending ?? 0,
        sections: sectionsCount ?? 0,
      });
    })();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Chiqdingiz");
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-display text-lg font-bold">Vazifa</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" /> Chiqish
          </Button>
        </div>
      </header>

      <main className="aurora-bg">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              Assalomu alaykum, {profile?.full_name ?? "Foydalanuvchi"} 👋
            </h1>
            <p className="mt-2 text-muted-foreground">
              Bugungi vazifalaringizning umumiy ko'rinishi.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<ListTodo className="size-5" />} label="Jami vazifalar" value={stats.total} />
            <StatCard icon={<CheckCircle2 className="size-5 text-success" />} label="Bajarilgan" value={stats.done} />
            <StatCard icon={<Clock className="size-5 text-warning" />} label="Kutilmoqda" value={stats.pending} />
            <StatCard icon={<Folder className="size-5 text-accent" />} label="Bo'limlar" value={stats.sections} />
          </div>

          <Card className="mt-8 glass border-border/50">
            <CardHeader>
              <CardTitle className="font-display">Keyingi qadamlar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                1-bosqich tugadi: ma'lumotlar bazasi, autentifikatsiya va dizayn tizimi tayyor.
                Keyingi bosqichda <strong className="text-foreground">bo'limlar boshqaruvi</strong> va{" "}
                <strong className="text-foreground">vazifa yaratish</strong> qo'shiladi.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="glass border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{label}</span>
          {icon}
        </div>
        <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

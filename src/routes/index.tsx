import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, BarChart3, Bell, Calendar, Users, Send } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Vazifa — Kunlik vazifalaringizni boshqaring" },
      { name: "description", content: "Kunlik, muddatli va bir martalik vazifalarni boshqarish, hisobotlar va analitika bilan shaxsiy mahsuldorlik tizimi." },
      { property: "og:title", content: "Vazifa — Kunlik vazifalaringizni boshqaring" },
      { property: "og:description", content: "Vazifa, hisobot va analitika bir joyda." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-display text-lg font-bold">Vazifa</span>
          </Link>
          <Link to="/auth">
            <Button>Kirish</Button>
          </Link>
        </nav>
      </header>

      <main className="aurora-bg">
        <section className="mx-auto max-w-4xl px-4 py-20 text-center md:py-32">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs">
            <span className="size-2 rounded-full bg-success" />
            Telegram bot bilan integratsiya
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            Vazifalaringizni{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              tartibga soling
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Kunlik, muddatli va bir martalik vazifalar. Bo'limlarga ajrating, hisobot oling,
            o'sishingizni kuzating.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg">Bepul boshlash</Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="grid gap-6 md:grid-cols-3">
            <Feature icon={<CheckCircle2 className="size-6" />} title="3 turdagi vazifa" body="Kunlik, muddatli va bir martalik — har birining o'z mantiq va eslatmalari." />
            <Feature icon={<Calendar className="size-6" />} title="Bo'limlar tizimi" body="Vazifalaringizni mavzular bo'yicha guruhlang, ranglar bilan ajrating." />
            <Feature icon={<BarChart3 className="size-6" />} title="Hisobot va analitika" body="Kunlik va haftalik avtomatik hisobotlar, grafiklar bilan." />
            <Feature icon={<Bell className="size-6" />} title="Aqlli eslatmalar" body="Muddat tugashidan oldin bildirishnoma oling." />
            <Feature icon={<Send className="size-6" />} title="Telegram bot" body="Vazifani tezda Telegram orqali qo'shing yoki belgilang." />
            <Feature icon={<Users className="size-6" />} title="Admin panel" body="Jamoaviy holatlarni kuzating, sozlamalarni boshqaring." />
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Vazifa. Barcha huquqlar himoyalangan.
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl border border-border/50 p-6">
      <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

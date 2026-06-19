import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { LayoutDashboard, Folder, ListTodo, BarChart3, Settings, LogOut, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/NotificationsBell";

const nav = [
  { to: "/dashboard", label: "Boshqaruv", icon: LayoutDashboard },
  { to: "/sections", label: "Bo'limlar", icon: Folder },
  { to: "/tasks", label: "Vazifalar", icon: ListTodo },
  { to: "/analytics", label: "Analitika", icon: BarChart3 },
  { to: "/settings", label: "Sozlamalar", icon: Settings },
] as const;

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Chiqdingiz");
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border/60 bg-card/40 backdrop-blur md:flex md:flex-col">
        <Link to="/dashboard" className="flex items-center gap-2 px-5 py-5">
          <Sparkles className="size-5 text-primary" />
          <span className="font-display text-lg font-bold">Vazifa</span>
        </Link>
        <nav className="flex-1 px-3">
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border/60 p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="size-4" /> Chiqish
          </Button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-10 border-b border-border/60 bg-card/60 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <h1 className="font-display text-xl font-bold md:text-2xl">{title}</h1>
            <div className="flex items-center gap-2">{actions}<NotificationsBell /></div>
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-border/40 px-2 py-2 md:hidden">
            {nav.map((item) => {
              const active = pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs",
                    active ? "bg-primary/15 text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="aurora-bg min-h-[calc(100vh-4rem)]">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}

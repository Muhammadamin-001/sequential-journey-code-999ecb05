import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  format,
  subDays,
  startOfDay,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { CheckCircle2, XCircle, Flame, TrendingUp } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analitika — Vazifa" }] }),
  component: AnalyticsPage,
});

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type History = Database["public"]["Tables"]["task_history"]["Row"];
type Section = Database["public"]["Tables"]["sections"]["Row"];

function AnalyticsPage() {
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*");
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["task_history", "30d"],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data, error } = await supabase
        .from("task_history")
        .select("*")
        .gte("created_at", since);
      if (error) throw error;
      return data as History[];
    },
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sections").select("*");
      if (error) throw error;
      return data as Section[];
    },
  });

  // 7-day completion chart
  const last7 = useMemo(() => {
    const days = eachDayOfInterval({
      start: subDays(startOfDay(new Date()), 6),
      end: startOfDay(new Date()),
    });
    return days.map((day) => {
      const dayHist = history.filter((h) =>
        isSameDay(new Date(h.occurred_on), day),
      );
      return {
        day: format(day, "EEE"),
        bajarildi: dayHist.filter((h) => h.status === "completed").length,
        otkazib: dayHist.filter((h) => h.status === "missed").length,
      };
    });
  }, [history]);

  // Section distribution
  const bySection = useMemo(() => {
    return sections
      .map((s) => ({
        name: s.name,
        value: tasks.filter((t) => t.section_id === s.id).length,
        color: s.color,
      }))
      .filter((x) => x.value > 0);
  }, [sections, tasks]);

  // Streak calculation
  const streak = useMemo(() => {
    const today = startOfDay(new Date());
    let count = 0;
    for (let i = 0; i < 60; i++) {
      const day = subDays(today, i);
      const has = history.some(
        (h) => h.status === "completed" && isSameDay(new Date(h.occurred_on), day),
      );
      if (has) count++;
      else if (i > 0) break;
    }
    return count;
  }, [history]);

  // Totals
  const completed = history.filter((h) => h.status === "completed").length;
  const missed = history.filter((h) => h.status === "missed").length;
  const rate = completed + missed === 0 ? 0 : Math.round((completed / (completed + missed)) * 100);

  return (
    <AppShell title="Analitika">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="30 kunlik bajarish" value={`${rate}%`} icon={TrendingUp} accent="text-primary">
          <Progress value={rate} className="mt-3 h-1.5" />
        </StatCard>
        <StatCard label="Bajarilgan" value={String(completed)} icon={CheckCircle2} accent="text-emerald-400" />
        <StatCard label="O'tkazib yuborilgan" value={String(missed)} icon={XCircle} accent="text-rose-400" />
        <StatCard label="Streak (kun)" value={String(streak)} icon={Flame} accent="text-amber-400" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="glass border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-lg">So'nggi 7 kun</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last7}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="bajarildi" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="otkazib" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="font-display text-lg">Bo'limlar bo'yicha</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {bySection.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Hali ma'lumot yo'q
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bySection} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                    {bySection.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass mt-6 border-border/50">
        <CardHeader>
          <CardTitle className="font-display text-lg">Vazifalar turlari</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {(["daily", "deadline", "onetime"] as const).map((type) => {
            const subset = tasks.filter((t) => t.task_type === type);
            const done = subset.filter((t) => t.status === "completed").length;
            const pct = subset.length === 0 ? 0 : Math.round((done / subset.length) * 100);
            const label = type === "daily" ? "Kunlik" : type === "deadline" ? "Muddatli" : "Bir martalik";
            return (
              <div key={type} className="rounded-lg border border-border/40 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <Badge variant="secondary">{subset.length}</Badge>
                </div>
                <div className="mt-2 text-2xl font-bold">{pct}%</div>
                <Progress value={pct} className="mt-2 h-1.5" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  children,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className="glass border-border/50">
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{label}</span>
          <Icon className={`size-4 ${accent}`} />
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
        {children}
      </CardContent>
    </Card>
  );
}

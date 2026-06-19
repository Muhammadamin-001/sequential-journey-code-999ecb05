import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User as UserIcon, Lock, Send, Globe } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Sozlamalar — Vazifa" }] }),
  component: SettingsPage,
});

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Role = Database["public"]["Enums"]["app_role"];

const TIMEZONES = [
  "Asia/Tashkent",
  "Asia/Samarkand",
  "Asia/Almaty",
  "Asia/Dubai",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Europe/London",
  "America/New_York",
  "UTC",
];

function SettingsPage() {
  const qc = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.role as Role);
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    timezone: "Asia/Tashkent",
    telegram_username: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        timezone: profile.timezone ?? "Asia/Tashkent",
        telegram_username: profile.telegram_username ?? "",
        avatar_url: profile.avatar_url ?? "",
      });
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Avtorizatsiya yo'q");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim() || null,
          timezone: form.timezone,
          telegram_username: form.telegram_username.trim() || null,
          avatar_url: form.avatar_url.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil yangilandi");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pw, setPw] = useState({ next: "", confirm: "" });
  const changePassword = useMutation({
    mutationFn: async () => {
      if (pw.next.length < 6) throw new Error("Parol kamida 6 ta belgi bo'lishi kerak");
      if (pw.next !== pw.confirm) throw new Error("Parollar mos kelmadi");
      const { error } = await supabase.auth.updateUser({ password: pw.next });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parol o'zgartirildi");
      setPw({ next: "", confirm: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (form.full_name || user?.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppShell title="Sozlamalar">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="glass border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <UserIcon className="size-5 text-primary" /> Profil
            </CardTitle>
            <CardDescription>Shaxsiy ma'lumotlaringizni boshqaring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="size-16 border border-border/60">
                <AvatarImage src={form.avatar_url} alt={form.full_name} />
                <AvatarFallback className="bg-primary/15 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium">{user?.email}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {roles.map((r) => (
                    <Badge key={r} variant={r === "admin" ? "default" : "secondary"}>
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>To'liq ism</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Ism Familiya"
                />
              </div>
              <div>
                <Label>Avatar URL</Label>
                <Input
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Globe className="size-3.5" /> Vaqt mintaqasi
                </Label>
                <Select
                  value={form.timezone}
                  onValueChange={(v) => setForm({ ...form, timezone: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-1.5">
                  <Send className="size-3.5" /> Telegram username
                </Label>
                <Input
                  value={form.telegram_username}
                  onChange={(e) =>
                    setForm({ ...form, telegram_username: e.target.value.replace(/^@/, "") })
                  }
                  placeholder="username"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Saqlangach, <a href="https://t.me/Atomodat_bot" target="_blank" rel="noreferrer" className="text-primary underline">@Atomodat_bot</a> ga kirib <code>/start</code> yuboring — eslatmalar Telegramga keladi.
                </p>
              </div>
            </div>

            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {saveProfile.isPending ? "Saqlanmoqda…" : "Saqlash"}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Lock className="size-5 text-primary" /> Parol
            </CardTitle>
            <CardDescription>Hisobingiz parolini o'zgartiring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Yangi parol</Label>
              <Input
                type="password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </div>
            <div>
              <Label>Takrorlang</Label>
              <Input
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => changePassword.mutate()}
              disabled={changePassword.isPending || !pw.next}
            >
              {changePassword.isPending ? "..." : "Parolni yangilash"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

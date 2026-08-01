import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export function NotificationsBell() {
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Notification[];
    },
    refetchInterval: 60_000,
  });

  // 60 soniyalik poll shu bo'yicha ham qoladi (masalan tarmoq uzilib
  // qayta ulanganda tiklovchi zaxira sifatida), lekin Realtime INSERT
  // hodisasi kelsa, ro'yxat deyarli darhol yangilanadi.
  //
  // ESLATMA: Supabase loyihasida `public.notifications` jadvali uchun
  // Realtime yoqilgan bo'lishi shart — Dashboard → Database → Replication
  // bo'limidan yoqing, aks holda bu obuna hech qachon hodisa olmaydi
  // (xato ham bermaydi, shunchaki jim tarzda ishlamaydi).
  useEffect(() => {
    let userId: string | undefined;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: RealtimePostgresInsertPayload<Notification>) => {
          // faqat joriy foydalanuvchiga tegishli bo'lsa invalidatsiya qil
          if (payload.new.user_id === userId) {
            qc.invalidateQueries({ queryKey: ["notifications"] });
          }
        },
      )
      .subscribe();

    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id;
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAll = useMutation({
    mutationFn: async () => {
      const ids = items.filter((n) => !n.is_read).map((n) => n.id);
      if (!ids.length) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="font-medium">Bildirishnomalar</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>
              Hammasini o'qildi
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Bildirishnomalar yo'q
            </div>
          ) : (
            <ul className="divide-y divide-border/40">
              {items.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <div
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      n.is_read ? "bg-muted" : "bg-primary"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">{n.title}</div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {n.type}
                      </Badge>
                    </div>
                    {n.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                    )}
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("uz-UZ")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/daily-reset")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const today = new Date().toISOString().slice(0, 10);

        // 1) Find daily tasks that were not completed today (status != completed OR completed_at < today)
        const { data: dailyTasks, error: dailyErr } = await supabaseAdmin
          .from("tasks")
          .select("id,user_id,status,completed_at,title")
          .eq("task_type", "daily");
        if (dailyErr) {
          return new Response(JSON.stringify({ error: dailyErr.message }), { status: 500 });
        }

        const missedHistory: Array<{ task_id: string; user_id: string; status: "missed"; occurred_on: string }> = [];
        const resetIds: string[] = [];
        const notifs: Array<{ user_id: string; title: string; body: string; type: string }> = [];

        for (const t of dailyTasks ?? []) {
          const completedToday =
            t.status === "completed" &&
            t.completed_at &&
            new Date(t.completed_at).toISOString().slice(0, 10) === today;

          if (!completedToday && t.status !== "completed") {
            missedHistory.push({
              task_id: t.id,
              user_id: t.user_id,
              status: "missed",
              occurred_on: today,
            });
            notifs.push({
              user_id: t.user_id,
              title: "Kunlik vazifa o'tkazib yuborildi",
              body: `"${t.title}" kechagi kuni bajarilmadi.`,
              type: "missed",
            });
          }
          resetIds.push(t.id);
        }

        if (missedHistory.length) {
          await supabaseAdmin.from("task_history").insert(missedHistory);
        }
        if (notifs.length) {
          await supabaseAdmin.from("notifications").insert(notifs);
        }
        if (resetIds.length) {
          await supabaseAdmin
            .from("tasks")
            .update({ status: "pending", completed_at: null })
            .in("id", resetIds);
        }

        // 2) Mark overdue deadline tasks as missed
        const nowIso = new Date().toISOString();
        const { data: overdue } = await supabaseAdmin
          .from("tasks")
          .select("id,user_id,title")
          .eq("task_type", "deadline")
          .eq("status", "pending")
          .lt("deadline_at", nowIso);

        if (overdue && overdue.length) {
          await supabaseAdmin
            .from("tasks")
            .update({ status: "missed" })
            .in("id", overdue.map((o) => o.id));
          await supabaseAdmin.from("notifications").insert(
            overdue.map((o) => ({
              user_id: o.user_id,
              title: "Muddat o'tib ketdi",
              body: `"${o.title}" muddati o'tdi.`,
              type: "missed",
            })),
          );
        }

        return Response.json({
          ok: true,
          reset: resetIds.length,
          missed: missedHistory.length,
          overdue: overdue?.length ?? 0,
        });
      },
    },
  },
});

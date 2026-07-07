import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FocusEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Pencil,
  Trash2,
  ListTodo,
  CalendarClock,
  Repeat,
  Zap,
  Clock,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { getTaskUrgency } from "@/lib/task-priority";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Vazifalar — Vazifa" }] }),
  component: TasksPage,
});

type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskType = Database["public"]["Enums"]["task_type"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];
type TaskStatus = Database["public"]["Enums"]["task_status"];

type Section = { id: string; name: string; color: string };

const TYPE_META: Record<TaskType, { label: string; icon: typeof Zap; hint: string }> = {
  daily: { label: "Kunlik", icon: Repeat, hint: "Har kuni takrorlanadigan odat" },
  deadline: { label: "Muddatli", icon: CalendarClock, hint: "Belgilangan muddatga ega" },
  onetime: { label: "Bir martalik", icon: Zap, hint: "Bir marta bajariladigan ish" },
};

const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: "Past", color: "#64748b" },
  medium: { label: "O'rta", color: "#06b6d4" },
  high: { label: "Yuqori", color: "#f59e0b" },
  urgent: { label: "Shoshilinch", color: "#ef4444" },
};

function getProgressPercent(metadata: TaskRow["metadata"]): number | undefined {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>).progress_percent;
    return typeof value === "number" ? value : undefined;
  }
  return undefined;
}

// getTaskUrgency() faqat kichik, aniq shakldagi obyektni kutadi — TaskRow'ni
// shunga moslashtiramiz. Bu sahifada daily_task_reports bilan join qilinmagani
// uchun `reportedToday` bermaymiz: kunlik vazifalar uchun bu faqat saralashga
// ta'sir qiladi (rank=3), UI'da alohida "hisobot yo'q" belgisi qo'yilmaydi.
function toUrgencyTask(t: TaskRow) {
  return {
    task_type: t.task_type,
    status: t.status,
    created_at: t.created_at,
    deadline_at: t.deadline_at,
    reminder_at: t.reminder_at,
    metadata: { progress_percent: getProgressPercent(t.metadata) },
  };
}

function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TaskRow[];
    },
  });
}

function useSections() {
  return useQuery({
    queryKey: ["sections", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id,name,color")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Section[];
    },
  });
}

function TasksPage() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: sections = [] } = useSections();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [tab, setTab] = useState<"all" | TaskType>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const bySection =
      sectionFilter === "all" ? tasks : tasks.filter((t) => t.section_id === sectionFilter);
    const byTab = tab === "all" ? bySection : bySection.filter((t) => t.task_type === tab);

    // Tab yoki bo'lim filtridan qat'iy nazar, ro'yxat doim shoshilinchlik
    // darajasi (getTaskUrgency().rank) bo'yicha saralanadi — shoshilinchi
    // yo'q vazifalar oxirida, o'zaro nisbiy tartibi saqlangan holda qoladi.
    return [...byTab].sort((a, b) => {
      const rankA = getTaskUrgency(toUrgencyTask(a))?.rank ?? Number.POSITIVE_INFINITY;
      const rankB = getTaskUrgency(toUrgencyTask(b))?.rank ?? Number.POSITIVE_INFINITY;
      return rankA - rankB;
    });
  }, [tasks, tab, sectionFilter]);

  return (
    <AppShell
      title="Vazifalar"
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Yangi vazifa
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <TabsList className="grid flex-1 grid-cols-4 sm:flex-none sm:w-auto">
            <TabsTrigger value="all">Hammasi</TabsTrigger>
            <TabsTrigger value="daily">Kunlik</TabsTrigger>
            <TabsTrigger value="deadline">Muddatli</TabsTrigger>
            <TabsTrigger value="onetime">Bir martalik</TabsTrigger>
          </TabsList>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Bo'lim" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha bo'limlar</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <TabsContent value={tab} className="mt-5">
          {isLoading ? (
            <div className="text-muted-foreground">Yuklanmoqda…</div>
          ) : filtered.length === 0 ? (
            <Card className="glass border-dashed border-border/60">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <ListTodo className="size-10 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Hozircha vazifa yo'q. Birinchisini qo'shing.
                </p>
                <Button
                  onClick={() => {
                    setEditing(null);
                    setOpen(true);
                  }}
                >
                  <Plus className="size-4" /> Yangi vazifa
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  sections={sections}
                  onEdit={() => {
                    setEditing(t);
                    setOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TaskDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        task={editing}
        sections={sections}
      />
    </AppShell>
  );
}

function TaskCard({
  task,
  sections,
  onEdit,
}: {
  task: TaskRow;
  sections: Section[];
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const section = sections.find((s) => s.id === task.section_id);
  const TypeIcon = TYPE_META[task.task_type].icon;
  const done = task.status === "completed";

  const toggle = useMutation({
    mutationFn: async (checked: boolean) => {
      const status: TaskStatus = checked ? "completed" : "pending";
      const { error } = await supabase
        .from("tasks")
        .update({
          status,
          completed_at: checked ? new Date().toISOString() : null,
        })
        .eq("id", task.id);
      if (error) throw error;

      if (checked) {
        const { data: u } = await supabase.auth.getUser();
        if (u.user) {
          await supabase.from("task_history").insert({
            task_id: task.id,
            user_id: u.user.id,
            status: "completed",
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("O'chirildi");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="glass border-border/50">
      <CardContent className="flex items-start gap-3 py-4">
        <Checkbox
          checked={done}
          onCheckedChange={(v) => toggle.mutate(Boolean(v))}
          className="mt-1"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                done
                  ? "font-medium text-muted-foreground line-through"
                  : "font-medium"
              }
            >
              {task.title}
            </span>
            <Badge variant="secondary" className="gap-1">
              <TypeIcon className="size-3" />
              {TYPE_META[task.task_type].label}
            </Badge>
            <Badge
              variant="outline"
              className="gap-1"
              style={{ borderColor: PRIORITY_META[task.priority].color + "66", color: PRIORITY_META[task.priority].color }}
            >
              <Flag className="size-3" />
              {PRIORITY_META[task.priority].label}
            </Badge>
            {section && (
              <Badge
                variant="outline"
                style={{ borderColor: section.color + "66", color: section.color }}
              >
                {section.name}
              </Badge>
            )}
          </div>
          {task.description && (
            <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
          )}
          {task.deadline_at && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {new Date(task.deadline_at).toLocaleString("uz-UZ")}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              if (confirm(`"${task.title}" o'chirilsinmi?`)) del.mutate();
            }}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TaskDialog({
  open,
  onOpenChange,
  task,
  sections,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: TaskRow | null;
  sections: Section[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    task_type: (task?.task_type ?? "onetime") as TaskType,
    priority: (task?.priority ?? "medium") as TaskPriority,
    section_id: task?.section_id ?? "",
    deadline_at: toLocalInput(task?.deadline_at ?? null),
    reminder_at: toLocalInput(task?.reminder_at ?? null),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Sarlavha kiritilishi shart");
      if (form.task_type === "deadline" && !form.deadline_at) {
        throw new Error("Muddatli vazifa uchun muddat kiritilishi shart");
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Avtorizatsiya yo'q");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        task_type: form.task_type,
        priority: form.priority,
        section_id: form.section_id || null,
        deadline_at:
          form.task_type === "deadline" && form.deadline_at
            ? new Date(form.deadline_at).toISOString()
            : null,
        reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null,
        recurrence:
          form.task_type === "daily" ? { frequency: "daily", interval: 1 } : null,
      };

      if (task) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert({ ...payload, user_id: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(task ? "Yangilandi" : "Qo'shildi");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Mobil klaviatura ochilganda fokusdagi maydon uning ostida qolib
  // ko'rinmay qolishining oldini olish uchun — real qurilmada tekshiring,
  // chunki brauzer/emulyator xatti-harakati farq qilishi mumkin.
  const scrollFieldIntoView = (e: FocusEvent<HTMLElement>) => {
    e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {task ? "Vazifani tahrirlash" : "Yangi vazifa"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Sarlavha</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onFocus={scrollFieldIntoView}
              placeholder="Masalan: Ertalabki yugurish"
            />
          </div>
          <div>
            <Label>Tavsif</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onFocus={scrollFieldIntoView}
              rows={2}
            />
          </div>
          <div>
            <Label>Vazifa turi</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_META) as TaskType[]).map((k) => {
                const M = TYPE_META[k];
                const Icon = M.icon;
                const active = form.task_type === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm({ ...form, task_type: k })}
                    className={`rounded-lg border p-3 text-left text-xs transition ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <Icon className="mb-1 size-4" />
                    <div className="font-medium">{M.label}</div>
                    <div className="mt-0.5 text-[10px] opacity-70">{M.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Muhimlik</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_META) as TaskPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bo'lim</Label>
              <Select
                value={form.section_id || "none"}
                onValueChange={(v) => setForm({ ...form, section_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Tanlanmagan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanlanmagan</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.task_type === "deadline" && (
            <div>
              <Label>
                Muddat <span className="text-destructive">*</span>
              </Label>
              <Input
                type="datetime-local"
                value={form.deadline_at}
                onChange={(e) => setForm({ ...form, deadline_at: e.target.value })}
                onFocus={scrollFieldIntoView}
              />
            </div>
          )}
          <div>
            <Label>Eslatma vaqti (ixtiyoriy)</Label>
            <Input
              type="datetime-local"
              value={form.reminder_at}
              onChange={(e) => setForm({ ...form, reminder_at: e.target.value })}
              onFocus={scrollFieldIntoView}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saqlanmoqda…" : "Saqlash"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
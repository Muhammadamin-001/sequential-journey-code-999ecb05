-- =====================================================================
-- STAGE 1 — Private sections, per-user defaults, admin visibility
-- lockdown, and daily/deadline reporting schema.
--
-- This migration is additive/data-safe where possible:
--  1) sections: backfill shared (created_by IS NULL) rows into private
--     per-user copies, re-point tasks, enforce NOT NULL, replace RLS.
--  2) handle_new_user(): also seeds 7 default sections per new signup.
--  3) Drop admin "view all" policies on tasks/task_history/
--     daily_reports/weekly_reports (private mode — admin role/
--     user_roles/admin_settings management is untouched).
--  4) daily_task_reports + deadline_task_reports + admin_broadcasts
--     tables with RLS.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1.1 — Bo'limlarni (sections) individual qilish
-- ---------------------------------------------------------------------

-- Eski umumiy bo'limlarni har bir mavjud foydalanuvchiga nusxalab, ularning
-- vazifalarini yangi shaxsiy nusxaga qayta bog'laymiz.
DO $$
DECLARE
  u RECORD;
  old_section RECORD;
  new_id UUID;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    FOR old_section IN SELECT * FROM public.sections WHERE created_by IS NULL LOOP
      INSERT INTO public.sections (name, description, color, icon, sort_order, is_active, created_by)
      VALUES (old_section.name, old_section.description, old_section.color,
              old_section.icon, old_section.sort_order, old_section.is_active, u.id)
      RETURNING id INTO new_id;

      UPDATE public.tasks
      SET section_id = new_id
      WHERE section_id = old_section.id AND user_id = u.id;
    END LOOP;
  END LOOP;

  DELETE FROM public.sections WHERE created_by IS NULL;
END $$;

ALTER TABLE public.sections ALTER COLUMN created_by SET NOT NULL;

DROP POLICY IF EXISTS "Anyone authenticated views sections" ON public.sections;
DROP POLICY IF EXISTS "Admins manage sections" ON public.sections;

CREATE POLICY "Users view own sections" ON public.sections
  FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Users insert own sections" ON public.sections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users update own sections" ON public.sections
  FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users delete own sections" ON public.sections
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Yangi ro'yxatdan o'tuvchilar uchun handle_new_user() trigger funksiyasini
-- yangilash (to'liq almashtirish):
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user_count INTEGER;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO existing_user_count FROM auth.users WHERE id <> NEW.id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN existing_user_count = 0 THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- YANGI: har bir yangi foydalanuvchi uchun shaxsiy standart bo'limlar
  INSERT INTO public.sections (name, description, color, icon, sort_order, created_by)
  VALUES
    ('Ish', 'Ish bilan bog''liq vazifalar', '#3b82f6', 'briefcase', 1, NEW.id),
    ('Shaxsiy', 'Shaxsiy vazifalar', '#8b5cf6', 'user', 2, NEW.id),
    ('Salomatlik', 'Sport, ovqat, tibbiyot', '#10b981', 'heart', 3, NEW.id),
    ('O''qish', 'O''rganish va rivojlanish', '#f59e0b', 'book-open', 4, NEW.id),
    ('Oila', 'Oila bilan bog''liq ishlar', '#ec4899', 'users', 5, NEW.id),
    ('Moliya', 'Pul va xarajatlar', '#06b6d4', 'wallet', 6, NEW.id),
    ('Loyihalar', 'Shaxsiy loyihalar', '#ef4444', 'rocket', 7, NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 1.2 — Private mode: adminning umumiy ko'rish huquqini olib tashlash
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins view all history" ON public.task_history;
DROP POLICY IF EXISTS "Admins view all daily reports" ON public.daily_reports;
DROP POLICY IF EXISTS "Admins view all weekly reports" ON public.weekly_reports;
-- Admin roli, user_roles va admin_settings boshqaruvi o'zgarmaydi —
-- faqat boshqa userlarning DATA'sini ko'rish huquqi olib tashlanadi.

-- ---------------------------------------------------------------------
-- 1.3 — Kunlik vazifalar uchun hisobot sxemasi
-- ---------------------------------------------------------------------

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS plan_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS plan_unit TEXT;

CREATE TABLE IF NOT EXISTS public.daily_task_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  reported_amount NUMERIC NOT NULL,
  percent NUMERIC NOT NULL, -- 0..100, insert vaqtida hisoblanadi
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, occurred_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_task_reports TO authenticated;
GRANT ALL ON public.daily_task_reports TO service_role;
ALTER TABLE public.daily_task_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own daily reports" ON public.daily_task_reports
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_daily_task_reports_task ON public.daily_task_reports(task_id, occurred_on);

-- ---------------------------------------------------------------------
-- 1.4 — Muddatli vazifalar uchun progress + hisobot sxemasi
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.deadline_task_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  delta_percent NUMERIC NOT NULL,       -- shu kun qo'shilgan/o'zgargan foiz
  resulting_percent NUMERIC NOT NULL,   -- shundan keyingi umumiy foiz
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, occurred_on)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deadline_task_reports TO authenticated;
GRANT ALL ON public.deadline_task_reports TO service_role;
ALTER TABLE public.deadline_task_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own deadline reports" ON public.deadline_task_reports
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_deadline_task_reports_task ON public.deadline_task_reports(task_id, occurred_on);

-- ---------------------------------------------------------------------
-- 1.5 — Admin ommaviy xabar audit jadvali
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID NOT NULL REFERENCES auth.users(id),
  title TEXT,
  body TEXT NOT NULL,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_broadcasts TO authenticated;
GRANT ALL ON public.admin_broadcasts TO service_role;
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage broadcasts" ON public.admin_broadcasts
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

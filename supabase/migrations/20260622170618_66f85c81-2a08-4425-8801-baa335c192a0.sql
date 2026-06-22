
-- Pending Telegram registration state (multi-step flow)
CREATE TABLE IF NOT EXISTS public.telegram_pending_registrations (
  chat_id BIGINT PRIMARY KEY,
  telegram_username TEXT,
  step TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_pending_registrations TO service_role;

ALTER TABLE public.telegram_pending_registrations ENABLE ROW LEVEL SECURITY;

-- No policies = no anon/authenticated access; service_role bypasses RLS.

CREATE TRIGGER trg_tpr_updated_at
  BEFORE UPDATE ON public.telegram_pending_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Singleton contest state
CREATE TABLE public.contest_state (
  id INT PRIMARY KEY DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  duration_seconds INT NOT NULL DEFAULT 5400,
  leaderboard_frozen BOOLEAN NOT NULL DEFAULT false,
  results_published BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contest_state_singleton CHECK (id = 1)
);
GRANT SELECT ON public.contest_state TO anon, authenticated;
GRANT ALL ON public.contest_state TO service_role;
ALTER TABLE public.contest_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contest state is public" ON public.contest_state FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.contest_state (id, state) VALUES (1, 'draft');

-- Admin config (never exposed to anon)
CREATE TABLE public.admin_config (
  id INT PRIMARY KEY DEFAULT 1,
  passcode TEXT NOT NULL DEFAULT 'RECOVER-2026',
  CONSTRAINT admin_config_singleton CHECK (id = 1)
);
GRANT ALL ON public.admin_config TO service_role;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_config (id) VALUES (1);

-- Participants
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  college TEXT NOT NULL,
  department TEXT NOT NULL,
  year TEXT NOT NULL,
  register_number TEXT NOT NULL,
  email TEXT NOT NULL,
  disqualified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX participants_register_number_key ON public.participants (lower(register_number));
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE public.participant_code_seq START 42;
GRANT ALL ON SEQUENCE public.participant_code_seq TO service_role;

-- Per-question progress
CREATE TABLE public.participant_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  question_id INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_attempted',
  best_score INT NOT NULL DEFAULT 0,
  max_score INT NOT NULL DEFAULT 0,
  last_code TEXT,
  solved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (participant_id, question_id)
);
GRANT ALL ON public.participant_progress TO service_role;
ALTER TABLE public.participant_progress ENABLE ROW LEVEL SECURITY;

-- Submissions
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  question_id INT NOT NULL,
  code TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'submit',
  passed INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 0,
  compile_error TEXT,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX submissions_participant_idx ON public.submissions (participant_id, question_id);
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Realtime for live leaderboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.participant_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_state;
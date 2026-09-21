import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { QUESTIONS, TOTAL_POINTS, getQuestion, type Question } from "./questions";
import { isSupabaseConfigured, localDb } from "./store.server";

export type ContestPhase = "draft" | "ready" | "live" | "ended" | "published";

export type ContestClock = {
  state: ContestPhase;
  startedAt: string | null;
  durationSeconds: number;
  serverNow: string;
  remainingSeconds: number;
  leaderboardFrozen: boolean;
  resultsPublished: boolean;
};

export type ProgressRow = {
  questionId: number;
  status: "not_attempted" | "attempted" | "solved" | "failed";
  bestScore: number;
  lastCode: string | null;
};

export type TestOutcome = {
  label: string;
  hidden: boolean;
  passed: boolean;
  stdin: string | null;
  expected: string | null;
  actual: string | null;
  stderr: string | null;
  timedOut: boolean;
};

export type ExecutionReport = {
  compileError: string | null;
  results: TestOutcome[];
  passed: number;
  total: number;
  score: number;
  maxScore: number;
  status: ProgressRow["status"];
  engineError: string | null;
};

const MAX_CODE_LENGTH = 25000;

function computeClock(row: {
  state: string;
  started_at: string | null;
  duration_seconds: number;
  leaderboard_frozen: boolean;
  results_published: boolean;
}): ContestClock {
  const now = Date.now();
  let remaining = row.duration_seconds;
  if (row.started_at) {
    const elapsed = Math.floor((now - new Date(row.started_at).getTime()) / 1000);
    remaining = Math.max(0, row.duration_seconds - elapsed);
  }
  if (row.state !== "live") {
    remaining = row.state === "ready" || row.state === "draft" ? row.duration_seconds : 0;
  }
  return {
    state: row.state as ContestPhase,
    startedAt: row.started_at,
    durationSeconds: row.duration_seconds,
    serverNow: new Date(now).toISOString(),
    remainingSeconds: remaining,
    leaderboardFrozen: row.leaderboard_frozen,
    resultsPublished: row.results_published,
  };
}

async function readClock(): Promise<ContestClock> {
  if (isSupabaseConfigured()) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("contest_state")
        .select("state, started_at, duration_seconds, leaderboard_frozen, results_published")
        .eq("id", 1)
        .single();
      if (!error && data) return computeClock(data);
    } catch {
      // fallback to localDb
    }
  }
  const row = localDb.getContestState();
  return computeClock(row);
}

export const getContestClock = createServerFn({ method: "GET" }).handler(async () => readClock());

/* ------------------------------ registration ------------------------------ */

const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(120),
  college: z.string().trim().default("Kongu Engineering College").optional(),
  department: z.string().trim().default("Electronics and Instrumentation Engineering").optional(),
  year: z.string().trim().default("2").optional(),
  registerNumber: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .refine(
      (val) => /^(25EIR|25EIL|24EIR|24EIL)/i.test(val),
      "Roll number must start with 25EIR or 25EIL"
    ),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .refine(
      (val) => val.toLowerCase().endsWith("@kongu.edu"),
      "Email must end with @kongu.edu"
    ),
});

export const registerParticipant = createServerFn({ method: "POST" })
  .validator((input: unknown) => registerSchema.parse(input))
  .handler(async ({ data }) => {
    const clock = await readClock();
    if (clock.state === "ended" || clock.state === "published") {
      return { ok: false as const, error: "The contest has ended. Registration is closed." };
    }

    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const existing = await supabaseAdmin
          .from("participants")
          .select("id, participant_code")
          .ilike("register_number", data.registerNumber)
          .maybeSingle();

        if (existing.data) {
          return {
            ok: true as const,
            participantId: existing.data.id,
            participantCode: existing.data.participant_code,
            returning: true,
          };
        }

        const count = await supabaseAdmin.from("participants").select("id", { count: "exact", head: true });
        const serial = 42 + (count.count ?? 0);
        const code = `SYS-2026-${String(serial).padStart(4, "0")}`;

        const inserted = await supabaseAdmin
          .from("participants")
          .insert({
            participant_code: code,
            full_name: data.fullName,
            college: data.college,
            department: data.department,
            year: data.year,
            register_number: data.registerNumber,
            email: data.email,
          })
          .select("id, participant_code")
          .single();

        if (inserted.data) {
          return {
            ok: true as const,
            participantId: inserted.data.id,
            participantCode: inserted.data.participant_code,
            returning: false,
          };
        }
      } catch {
        // Fall back to localDb
      }
    }

    // Local DB fallback
    const existing = localDb.findParticipantByReg(data.registerNumber);
    if (existing) {
      return {
        ok: true as const,
        participantId: existing.id,
        participantCode: existing.participant_code,
        returning: true,
      };
    }

    const created = localDb.createParticipant({
      full_name: data.fullName,
      college: data.college,
      department: data.department,
      year: data.year,
      register_number: data.registerNumber,
      email: data.email,
    });

    return {
      ok: true as const,
      participantId: created.id,
      participantCode: created.participant_code,
      returning: false,
    };
  });

/* ------------------------------- dashboard -------------------------------- */

const idSchema = z.object({ participantId: z.string() });

export const getParticipantSnapshot = createServerFn({ method: "POST" })
  .validator((input: unknown) => idSchema.parse(input))
  .handler(async ({ data }) => {
    const clock = await readClock();

    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const participant = await supabaseAdmin
          .from("participants")
          .select("id, participant_code, full_name, college, department, year, disqualified")
          .eq("id", data.participantId)
          .maybeSingle();

        if (participant.data) {
          const progress = await supabaseAdmin
            .from("participant_progress")
            .select("question_id, status, best_score, last_code")
            .eq("participant_id", data.participantId);

          const rows: ProgressRow[] = (progress.data ?? []).map((r) => ({
            questionId: r.question_id,
            status: r.status as ProgressRow["status"],
            bestScore: r.best_score,
            lastCode: r.last_code,
          }));

          const score = rows.reduce((sum, r) => sum + r.bestScore, 0);
          const solved = rows.filter((r) => r.status === "solved").length;

          return {
            ok: true as const,
            clock,
            participant: {
              id: participant.data.id,
              code: participant.data.participant_code,
              name: participant.data.full_name,
              college: participant.data.college,
              department: participant.data.department,
              year: participant.data.year,
              disqualified: participant.data.disqualified,
              tabSwitchCount: (participant.data as any).tab_switch_count ?? 0,
              awayDurationSeconds: (participant.data as any).away_duration_seconds ?? 0,
            },
            progress: rows,
            score,
            solved,
            totalPoints: TOTAL_POINTS,
            totalQuestions: QUESTIONS.length,
          };
        }
      } catch {
        // Fall back to localDb
      }
    }

    // Local DB fallback
    const participant = localDb.getParticipant(data.participantId);
    if (!participant) {
      return { ok: false as const, error: "Unknown participant token." };
    }

    const progressRows = localDb.getProgress(data.participantId);
    const rows: ProgressRow[] = progressRows.map((r) => ({
      questionId: r.question_id,
      status: r.status,
      bestScore: r.best_score,
      lastCode: r.last_code,
    }));

    const score = rows.reduce((sum, r) => sum + r.bestScore, 0);
    const solved = rows.filter((r) => r.status === "solved").length;

    return {
      ok: true as const,
      clock,
      participant: {
        id: participant.id,
        code: participant.participant_code,
        name: participant.full_name,
        college: participant.college,
        department: participant.department,
        year: participant.year,
        disqualified: participant.disqualified,
        tabSwitchCount: participant.tab_switch_count ?? 0,
        awayDurationSeconds: participant.away_duration_seconds ?? 0,
      },
      progress: rows,
      score,
      solved,
      totalPoints: TOTAL_POINTS,
      totalQuestions: QUESTIONS.length,
    };
  });

/* ------------------------------- proctoring ------------------------------- */

const tabViolationSchema = z.object({
  participantId: z.string(),
  awaySeconds: z.number().int().nonnegative(),
});

export const recordTabViolation = createServerFn({ method: "POST" })
  .validator((input: unknown) => tabViolationSchema.parse(input))
  .handler(async ({ data }) => {
    let violationCount = 0;
    let awayDurationSeconds = 0;
    let disqualified = false;

    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const existing = await supabaseAdmin
          .from("participants")
          .select("tab_switch_count, away_duration_seconds, disqualified")
          .eq("id", data.participantId)
          .maybeSingle();

        if (existing.data) {
          violationCount = (((existing.data as any).tab_switch_count as number) || 0) + 1;
          awayDurationSeconds =
            (((existing.data as any).away_duration_seconds as number) || 0) +
            Math.max(1, data.awaySeconds);
          disqualified = violationCount >= 3 || Boolean(existing.data.disqualified);

          await (supabaseAdmin as any)
            .from("participants")
            .update({
              tab_switch_count: violationCount,
              away_duration_seconds: awayDurationSeconds,
              last_violation_at: new Date().toISOString(),
              disqualified,
            })
            .eq("id", data.participantId);

          return {
            ok: true as const,
            violationCount,
            awayDurationSeconds,
            disqualified,
          };
        }
      } catch (e) {
        console.error("[Supabase] Failed to record tab violation:", e);
      }
    }

    const res = localDb.recordTabViolation(data.participantId, data.awaySeconds);
    return {
      ok: true as const,
      violationCount: res.tab_switch_count,
      awayDurationSeconds: res.away_duration_seconds,
      disqualified: res.disqualified,
    };
  });

/* --------------------------------- judge ---------------------------------- */

const runSchema = z.object({
  participantId: z.string(),
  questionId: z.number().int().min(1).max(12),
  code: z.string().min(1).max(MAX_CODE_LENGTH),
});

async function evaluate(
  questionId: number,
  code: string,
  includeHidden: boolean
): Promise<ExecutionReport> {
  const question = getQuestion(questionId);
  if (!question) throw new Error("unknown question");

  const { executeC, normalizeOutput, delay } = await import("./judge.server");
  const tests = question.tests.filter((t) => includeHidden || !t.hidden);

  const results: TestOutcome[] = [];
  let compileError: string | null = null;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i]!;
    try {
      const run = await executeC(code, test.stdin);
      if (run.compileError) {
        compileError = run.compileError;
        break;
      }
      const actual = normalizeOutput(run.stdout);
      const expected = normalizeOutput(test.expected);
      const passed = actual === expected && run.exitCode === 0 && !run.timedOut;
      results.push({
        label: test.label,
        hidden: test.hidden,
        passed,
        stdin: test.hidden ? null : test.stdin,
        expected: test.hidden ? null : expected,
        actual: test.hidden ? null : actual,
        stderr: run.stderr ? run.stderr.slice(0, 2000) : null,
        timedOut: run.timedOut,
      });
    } catch (error) {
      return {
        compileError: null,
        results,
        passed: 0,
        total: tests.length,
        score: 0,
        maxScore: question.points,
        status: "attempted",
        engineError: error instanceof Error ? error.message : "execution engine unreachable",
      };
    }
    if (i < tests.length - 1) await delay(200);
  }

  const total = tests.length;
  const passed = results.filter((r) => r.passed).length;
  const score = compileError ? 0 : Math.round((question.points * passed) / total);
  const status: ProgressRow["status"] = compileError
    ? "failed"
    : passed === total
      ? "solved"
      : passed === 0
        ? "failed"
        : "attempted";

  return {
    compileError,
    results,
    passed,
    total,
    score,
    maxScore: question.points,
    status,
    engineError: null,
  };
}

async function assertLive(participantId: string) {
  const clock = await readClock();
  if (clock.state !== "live" || clock.remainingSeconds <= 0) {
    return { error: "The contest is not live. Code execution is locked." };
  }

  if (isSupabaseConfigured()) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const participant = await supabaseAdmin
        .from("participants")
        .select("id, disqualified")
        .eq("id", participantId)
        .maybeSingle();
      if (!participant.data) return { error: "Unknown participant token." };
      if (participant.data.disqualified) return { error: "This access record has been suspended." };
      return { error: null };
    } catch {
      // fallback
    }
  }

  const participant = localDb.getParticipant(participantId);
  if (!participant) return { error: "Unknown participant token." };
  if (participant.disqualified) return { error: "This access record has been suspended." };
  return { error: null };
}

export const runCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => runSchema.parse(input))
  .handler(async ({ data }) => {
    const gate = await assertLive(data.participantId);
    if (gate.error) return { ok: false as const, error: gate.error };

    const report = await evaluate(data.questionId, data.code, false);

    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("submissions").insert({
          participant_id: data.participantId,
          question_id: data.questionId,
          code: data.code,
          kind: "run",
          passed: report.passed,
          total: report.total,
          score: 0,
          compile_error: report.compileError,
          detail: { results: report.results.map(({ label, passed }) => ({ label, passed })) },
        });
      } catch {
        // fallback to localDb
        localDb.addSubmission({
          participant_id: data.participantId,
          question_id: data.questionId,
          code: data.code,
          kind: "run",
          passed: report.passed,
          total: report.total,
          score: 0,
          compile_error: report.compileError,
          detail: { results: report.results.map(({ label, passed }) => ({ label, passed })) },
        });
      }
    } else {
      localDb.addSubmission({
        participant_id: data.participantId,
        question_id: data.questionId,
        code: data.code,
        kind: "run",
        passed: report.passed,
        total: report.total,
        score: 0,
        compile_error: report.compileError,
        detail: { results: report.results.map(({ label, passed }) => ({ label, passed })) },
      });
    }

    return { ok: true as const, report };
  });

export const submitCode = createServerFn({ method: "POST" })
  .validator((input: unknown) => runSchema.parse(input))
  .handler(async ({ data }) => {
    const gate = await assertLive(data.participantId);
    if (gate.error) return { ok: false as const, error: gate.error };

    const report = await evaluate(data.questionId, data.code, true);

    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("submissions").insert({
          participant_id: data.participantId,
          question_id: data.questionId,
          code: data.code,
          kind: "submit",
          passed: report.passed,
          total: report.total,
          score: report.score,
          compile_error: report.compileError,
          detail: { results: report.results.map(({ label, passed, hidden }) => ({ label, passed, hidden })) },
        });

        if (!report.engineError) {
          const existing = await supabaseAdmin
            .from("participant_progress")
            .select("id, best_score, status, solved_at")
            .eq("participant_id", data.participantId)
            .eq("question_id", data.questionId)
            .maybeSingle();

          const bestScore = Math.max(existing.data?.best_score ?? 0, report.score);
          const alreadySolved = existing.data?.status === "solved";
          const status = alreadySolved ? "solved" : report.status;
          const solvedAt =
            existing.data?.solved_at ?? (report.status === "solved" ? new Date().toISOString() : null);

          await supabaseAdmin.from("participant_progress").upsert(
            {
              participant_id: data.participantId,
              question_id: data.questionId,
              status,
              best_score: bestScore,
              max_score: report.maxScore,
              last_code: data.code,
              solved_at: solvedAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "participant_id,question_id" }
          );
        }

        return { ok: true as const, report };
      } catch {
        // Fall back to localDb
      }
    }

    // Local DB fallback
    localDb.addSubmission({
      participant_id: data.participantId,
      question_id: data.questionId,
      code: data.code,
      kind: "submit",
      passed: report.passed,
      total: report.total,
      score: report.score,
      compile_error: report.compileError,
      detail: { results: report.results.map(({ label, passed, hidden }) => ({ label, passed, hidden })) },
    });

    if (!report.engineError) {
      const existingProg = localDb
        .getProgress(data.participantId)
        .find((p) => p.question_id === data.questionId);

      const bestScore = Math.max(existingProg?.best_score ?? 0, report.score);
      const alreadySolved = existingProg?.status === "solved";
      const status = alreadySolved ? "solved" : report.status;
      const solvedAt =
        existingProg?.solved_at ?? (report.status === "solved" ? new Date().toISOString() : null);

      localDb.upsertProgress({
        participant_id: data.participantId,
        question_id: data.questionId,
        status,
        best_score: bestScore,
        max_score: report.maxScore,
        last_code: data.code,
        solved_at: solvedAt,
        updated_at: new Date().toISOString(),
      });
    }

    return { ok: true as const, report };
  });

export const saveDraft = createServerFn({ method: "POST" })
  .validator((input: unknown) => runSchema.parse(input))
  .handler(async ({ data }) => {
    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const existing = await supabaseAdmin
          .from("participant_progress")
          .select("id, status, best_score")
          .eq("participant_id", data.participantId)
          .eq("question_id", data.questionId)
          .maybeSingle();

        await supabaseAdmin.from("participant_progress").upsert(
          {
            participant_id: data.participantId,
            question_id: data.questionId,
            status: existing.data?.status ?? "attempted",
            best_score: existing.data?.best_score ?? 0,
            last_code: data.code,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "participant_id,question_id" }
        );
        return { ok: true as const };
      } catch {
        // Fall back to localDb
      }
    }

    const existing = localDb
      .getProgress(data.participantId)
      .find((p) => p.question_id === data.questionId);

    localDb.upsertProgress({
      participant_id: data.participantId,
      question_id: data.questionId,
      status: existing?.status ?? "attempted",
      best_score: existing?.best_score ?? 0,
      max_score: getQuestion(data.questionId)?.points ?? 5,
      last_code: data.code,
      solved_at: existing?.solved_at ?? null,
      updated_at: new Date().toISOString(),
    });

    return { ok: true as const };
  });

/* ------------------------------ leaderboard ------------------------------- */

export type LeaderboardRow = {
  rank: number;
  participantCode: string;
  name: string;
  rollNo: string;
  score: number;
  solved: number;
  lastSolvedAt: string | null;
};

export const getLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const clock = await readClock();

  if (clock.leaderboardFrozen && clock.state === "live") {
    return { frozen: true as const, clock, rows: [] as LeaderboardRow[] };
  }

  let participants: { id: string; participant_code: string; full_name: string; register_number: string }[] = [];
  let progress: { participant_id: string; best_score: number; status: string; solved_at: string | null }[] = [];

  if (isSupabaseConfigured()) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const pData = await supabaseAdmin
        .from("participants")
        .select("id, participant_code, full_name, register_number, disqualified")
        .eq("disqualified", false);

      const prData = await supabaseAdmin
        .from("participant_progress")
        .select("participant_id, best_score, status, solved_at");

      if (pData.data && prData.data) {
        participants = pData.data;
        progress = prData.data;
      }
    } catch {
      // fallback
    }
  }

  if (participants.length === 0) {
    participants = localDb
      .listParticipants()
      .filter((p) => !p.disqualified)
      .map((p) => ({
        id: p.id,
        participant_code: p.participant_code,
        full_name: p.full_name,
        register_number: p.register_number,
      }));
    progress = localDb.getAllProgress();
  }

  const map = new Map<string, { score: number; solved: number; last: string | null }>();
  for (const row of progress) {
    const entry = map.get(row.participant_id) ?? { score: 0, solved: 0, last: null };
    entry.score += row.best_score;
    if (row.status === "solved") {
      entry.solved += 1;
      if (row.solved_at && (!entry.last || row.solved_at > entry.last)) entry.last = row.solved_at;
    }
    map.set(row.participant_id, entry);
  }

  const rows = participants
    .map((p) => {
      const entry = map.get(p.id) ?? { score: 0, solved: 0, last: null };
      return {
        participantCode: p.participant_code,
        name: p.full_name,
        rollNo: p.register_number,
        score: entry.score,
        solved: entry.solved,
        lastSolvedAt: entry.last,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.solved !== a.solved) return b.solved - a.solved;
      if (a.lastSolvedAt && b.lastSolvedAt) return a.lastSolvedAt.localeCompare(b.lastSolvedAt);
      if (a.lastSolvedAt) return -1;
      if (b.lastSolvedAt) return 1;
      return a.rollNo.localeCompare(b.rollNo);
    })
    .map((row, index) => ({ rank: index + 1, ...row }));

  return { frozen: false as const, clock, rows };
});

/* --------------------------------- admin ---------------------------------- */

const passSchema = z.object({ passcode: z.string().min(1).max(200) });

async function checkPasscode(passcode: string): Promise<boolean> {
  const envPass = process.env.ADMIN_PASSCODE || "RECOVER-2026";
  if (passcode === envPass) return true;
  return localDb.checkPasscode(passcode);
}

export const adminLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) => passSchema.parse(input))
  .handler(async ({ data }) => ({ ok: await checkPasscode(data.passcode) }));

const adminStateSchema = passSchema.extend({
  state: z.enum(["draft", "ready", "live", "ended", "published"]).optional(),
  leaderboardFrozen: z.boolean().optional(),
  resultsPublished: z.boolean().optional(),
  durationSeconds: z.number().int().min(300).max(36000).optional(),
  restartClock: z.boolean().optional(),
});

export const adminUpdateContest = createServerFn({ method: "POST" })
  .validator((input: unknown) => adminStateSchema.parse(input))
  .handler(async ({ data }) => {
    if (!(await checkPasscode(data.passcode))) return { ok: false as const, error: "Invalid passcode" };

    const patch: {
      updated_at: string;
      state?: ContestPhase;
      started_at?: string | null;
      leaderboard_frozen?: boolean;
      results_published?: boolean;
      duration_seconds?: number;
    } = { updated_at: new Date().toISOString() };

    if (data.state) {
      patch.state = data.state;
      if (data.state === "live") {
        const current = await readClock();
        if (!current.startedAt || data.restartClock) {
          patch.started_at = new Date().toISOString();
        }
      }
      if (data.state === "ready" || data.state === "draft") patch.started_at = null;
    }
    if (data.leaderboardFrozen !== undefined) patch.leaderboard_frozen = data.leaderboardFrozen;
    if (data.resultsPublished !== undefined) patch.results_published = data.resultsPublished;
    if (data.durationSeconds !== undefined) patch.duration_seconds = data.durationSeconds;

    localDb.updateContestState(patch);

    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("contest_state").update(patch).eq("id", 1);
      } catch {
        // fallback already saved
      }
    }

    return { ok: true as const, clock: await readClock() };
  });

export const adminOverview = createServerFn({ method: "POST" })
  .validator((input: unknown) => passSchema.parse(input))
  .handler(async ({ data }) => {
    if (!(await checkPasscode(data.passcode))) return { ok: false as const, error: "Invalid passcode" };

    const clock = await readClock();

    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const participants = await supabaseAdmin
          .from("participants")
          .select("id, participant_code, full_name, college, department, year, register_number, email, disqualified, tab_switch_count, away_duration_seconds, last_violation_at, created_at")
          .order("created_at", { ascending: true });

        const progress = await supabaseAdmin
          .from("participant_progress")
          .select("participant_id, question_id, status, best_score");

        const submissions = await supabaseAdmin
          .from("submissions")
          .select("id, participant_id, question_id, kind, passed, total, score, compile_error, created_at, code")
          .order("created_at", { ascending: false })
          .limit(200);

        if (participants.data) {
          return {
            ok: true as const,
            clock,
            storageBackend: "supabase" as const,
            backendReason: "Connected to Cloud Supabase",
            participants: participants.data ?? [],
            progress: progress.data ?? [],
            submissions: submissions.data ?? [],
            questions: QUESTIONS,
          };
        } else if (participants.error) {
          console.error("[getAdminSnapshot] Supabase query error:", participants.error);
          return {
            ok: true as const,
            clock,
            storageBackend: "local" as const,
            backendReason: `Supabase query error: ${participants.error.message}`,
            participants: localDb.listParticipants(),
            progress: localDb.getAllProgress(),
            submissions: localDb.listSubmissions(),
            questions: QUESTIONS,
          };
        }
      } catch (err: any) {
        console.error("[getAdminSnapshot] Supabase connection exception:", err);
        return {
          ok: true as const,
          clock,
          storageBackend: "local" as const,
          backendReason: `Supabase exception: ${err?.message || String(err)}`,
          participants: localDb.listParticipants(),
          progress: localDb.getAllProgress(),
          submissions: localDb.listSubmissions(),
          questions: QUESTIONS,
        };
      }
    }

    return {
      ok: true as const,
      clock,
      storageBackend: "local" as const,
      backendReason: "No SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY detected in environment",
      participants: localDb.listParticipants(),
      progress: localDb.getAllProgress(),
      submissions: localDb.listSubmissions(),
      questions: QUESTIONS,
    };
  });

const participantActionSchema = passSchema.extend({
  participantId: z.string(),
  action: z.enum(["suspend", "restore", "delete", "reset", "clear_violations"]),
});

export const adminParticipantAction = createServerFn({ method: "POST" })
  .validator((input: unknown) => participantActionSchema.parse(input))
  .handler(async ({ data }) => {
    if (!(await checkPasscode(data.passcode))) return { ok: false as const, error: "Invalid passcode" };

    if (data.action === "delete") {
      localDb.deleteParticipant(data.participantId);
    } else if (data.action === "reset") {
      localDb.resetParticipantProgress(data.participantId);
    } else if (data.action === "clear_violations") {
      localDb.resetParticipantViolations(data.participantId);
    } else {
      localDb.updateParticipantDisqualified(data.participantId, data.action === "suspend");
    }

    if (isSupabaseConfigured()) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (data.action === "delete") {
          await supabaseAdmin.from("participants").delete().eq("id", data.participantId);
        } else if (data.action === "reset") {
          await supabaseAdmin.from("participant_progress").delete().eq("participant_id", data.participantId);
        } else if (data.action === "clear_violations") {
          await (supabaseAdmin as any)
            .from("participants")
            .update({
              tab_switch_count: 0,
              away_duration_seconds: 0,
              last_violation_at: null,
              disqualified: false,
            })
            .eq("id", data.participantId);
        } else {
          await supabaseAdmin
            .from("participants")
            .update({ disqualified: data.action === "suspend" })
            .eq("id", data.participantId);
        }
      } catch {
        // Fall back already applied
      }
    }

    return { ok: true as const };
  });

/* ----------------------------- Question Management ----------------------------- */

export const adminGetQuestions = createServerFn({ method: "POST" })
  .validator((input: unknown) => passSchema.parse(input))
  .handler(async ({ data }) => {
    if (!(await checkPasscode(data.passcode))) return { ok: false as const, error: "Invalid passcode" };
    return { ok: true as const, questions: QUESTIONS };
  });

const resetViolationsSchema = passSchema.extend({
  participantId: z.string(),
});

export const adminResetViolations = createServerFn({ method: "POST" })
  .validator((input: unknown) => resetViolationsSchema.parse(input))
  .handler(async ({ data }) => {
    if (!(await checkPasscode(data.passcode))) return { ok: false as const, error: "Invalid passcode" };
    const success = localDb.resetParticipantViolations(data.participantId);
    return { ok: success };
  });

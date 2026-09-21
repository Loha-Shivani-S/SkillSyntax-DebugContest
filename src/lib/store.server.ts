import fs from "node:fs";
import path from "node:path";

// Unified Contest Data Store
// Automatically detects and uses Supabase if configured.
// Otherwise, provides a robust, zero-configuration local database persisted to disk.

export type ContestStateRow = {
  id: number;
  state: "draft" | "ready" | "live" | "ended" | "published";
  started_at: string | null;
  duration_seconds: number;
  leaderboard_frozen: boolean;
  results_published: boolean;
  updated_at: string;
};

export type ParticipantRow = {
  id: string;
  participant_code: string;
  full_name: string;
  college: string;
  department: string;
  year: string;
  register_number: string;
  email: string;
  disqualified: boolean;
  tab_switch_count: number;
  away_duration_seconds: number;
  last_violation_at: string | null;
  created_at: string;
};

export type ProgressRowDb = {
  id: string;
  participant_id: string;
  question_id: number;
  status: "not_attempted" | "attempted" | "solved" | "failed";
  best_score: number;
  max_score: number;
  last_code: string | null;
  solved_at: string | null;
  updated_at: string;
};

export type SubmissionRow = {
  id: string;
  participant_id: string;
  question_id: number;
  code: string;
  kind: "run" | "submit";
  passed: number;
  total: number;
  score: number;
  compile_error: string | null;
  detail: unknown;
  created_at: string;
};

type LocalDbSchema = {
  contest_state: ContestStateRow;
  admin_passcode: string;
  participants: ParticipantRow[];
  progress: ProgressRowDb[];
  submissions: SubmissionRow[];
};

const DB_FILE = path.resolve(process.cwd(), ".contest_db.json");

function getInitialState(): LocalDbSchema {
  return {
    contest_state: {
      id: 1,
      state: "live",
      started_at: new Date().toISOString(),
      duration_seconds: 5400, // 90 minutes
      leaderboard_frozen: false,
      results_published: false,
      updated_at: new Date().toISOString(),
    },
    admin_passcode: process.env.ADMIN_PASSCODE || "RECOVER-2026",
    participants: [],
    progress: [],
    submissions: [],
  };
}

let memoryDb: LocalDbSchema | null = null;

function loadLocalDb(): LocalDbSchema {
  if (memoryDb) return memoryDb;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      memoryDb = JSON.parse(raw);
      if (memoryDb?.participants) {
        memoryDb.participants.forEach((p) => {
          if (typeof (p as any).tab_switch_count !== "number") (p as any).tab_switch_count = 0;
          if (typeof (p as any).away_duration_seconds !== "number") (p as any).away_duration_seconds = 0;
          if (!("last_violation_at" in (p as object))) (p as any).last_violation_at = null;
        });
      }
      return memoryDb!;
    }
  } catch (e) {
    console.warn("[LocalDb] Failed to read disk DB, initializing fresh:", e);
  }
  memoryDb = getInitialState();
  saveLocalDb();
  return memoryDb;
}

function saveLocalDb(): void {
  if (!memoryDb) return;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2), "utf8");
  } catch (e) {
    console.error("[LocalDb] Failed to save DB to disk:", e);
  }
}

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  return Boolean(url && key);
}

// Local Database Adapter with Supabase-like fluent query interface for seamless fallback
export const localDb = {
  getContestState(): ContestStateRow {
    const db = loadLocalDb();
    return db.contest_state;
  },

  updateContestState(patch: Partial<ContestStateRow>): ContestStateRow {
    const db = loadLocalDb();
    db.contest_state = {
      ...db.contest_state,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    saveLocalDb();
    return db.contest_state;
  },

  checkPasscode(code: string): boolean {
    const db = loadLocalDb();
    const envPass = process.env.ADMIN_PASSCODE || "RECOVER-2026";
    return code === db.admin_passcode || code === envPass;
  },

  findParticipantByReg(reg: string): ParticipantRow | undefined {
    const db = loadLocalDb();
    return db.participants.find(
      (p) => p.register_number.toLowerCase() === reg.toLowerCase()
    );
  },

  getParticipant(id: string): ParticipantRow | undefined {
    const db = loadLocalDb();
    return db.participants.find((p) => p.id === id);
  },

  listParticipants(): ParticipantRow[] {
    const db = loadLocalDb();
    return [...db.participants].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  },

  createParticipant(data: Omit<ParticipantRow, "id" | "participant_code" | "disqualified" | "created_at">): ParticipantRow {
    const db = loadLocalDb();
    const count = db.participants.length;
    const serial = 42 + count;
    const code = `SYS-2026-${String(serial).padStart(4, "0")}`;
    const id = `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const row: ParticipantRow = {
      id,
      participant_code: code,
      full_name: data.full_name,
      college: data.college,
      department: data.department,
      year: data.year,
      register_number: data.register_number,
      email: data.email,
      disqualified: false,
      tab_switch_count: 0,
      away_duration_seconds: 0,
      last_violation_at: null,
      created_at: new Date().toISOString(),
    };

    db.participants.push(row);
    saveLocalDb();
    return row;
  },

  recordTabViolation(
    participantId: string,
    awaySeconds: number
  ): {
    tab_switch_count: number;
    away_duration_seconds: number;
    disqualified: boolean;
  } {
    const db = loadLocalDb();
    const p = db.participants.find((x) => x.id === participantId);
    if (!p) {
      return { tab_switch_count: 0, away_duration_seconds: 0, disqualified: false };
    }
    p.tab_switch_count = (p.tab_switch_count || 0) + 1;
    p.away_duration_seconds = (p.away_duration_seconds || 0) + Math.max(1, awaySeconds);
    p.last_violation_at = new Date().toISOString();
    if (p.tab_switch_count >= 3) {
      p.disqualified = true;
    }
    saveLocalDb();
    return {
      tab_switch_count: p.tab_switch_count,
      away_duration_seconds: p.away_duration_seconds,
      disqualified: p.disqualified,
    };
  },

  resetParticipantViolations(id: string): boolean {
    const db = loadLocalDb();
    const p = db.participants.find((x) => x.id === id);
    if (!p) return false;
    p.tab_switch_count = 0;
    p.away_duration_seconds = 0;
    p.last_violation_at = null;
    p.disqualified = false;
    saveLocalDb();
    return true;
  },

  updateParticipantDisqualified(id: string, disqualified: boolean): boolean {
    const db = loadLocalDb();
    const p = db.participants.find((x) => x.id === id);
    if (!p) return false;
    p.disqualified = disqualified;
    saveLocalDb();
    return true;
  },

  deleteParticipant(id: string): boolean {
    const db = loadLocalDb();
    db.participants = db.participants.filter((p) => p.id !== id);
    db.progress = db.progress.filter((pr) => pr.participant_id !== id);
    db.submissions = db.submissions.filter((s) => s.participant_id !== id);
    saveLocalDb();
    return true;
  },

  resetParticipantProgress(id: string): boolean {
    const db = loadLocalDb();
    db.progress = db.progress.filter((pr) => pr.participant_id !== id);
    saveLocalDb();
    return true;
  },

  getProgress(participantId: string): ProgressRowDb[] {
    const db = loadLocalDb();
    return db.progress.filter((p) => p.participant_id === participantId);
  },

  getAllProgress(): ProgressRowDb[] {
    const db = loadLocalDb();
    return db.progress;
  },

  upsertProgress(item: Omit<ProgressRowDb, "id">): ProgressRowDb {
    const db = loadLocalDb();
    const existing = db.progress.find(
      (p) => p.participant_id === item.participant_id && p.question_id === item.question_id
    );

    if (existing) {
      existing.status = item.status;
      existing.best_score = item.best_score;
      existing.max_score = item.max_score;
      existing.last_code = item.last_code;
      if (item.solved_at) existing.solved_at = item.solved_at;
      existing.updated_at = new Date().toISOString();
      saveLocalDb();
      return existing;
    }

    const newRow: ProgressRowDb = {
      id: `prog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...item,
      updated_at: new Date().toISOString(),
    };
    db.progress.push(newRow);
    saveLocalDb();
    return newRow;
  },

  addSubmission(sub: Omit<SubmissionRow, "id" | "created_at">): SubmissionRow {
    const db = loadLocalDb();
    const row: SubmissionRow = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...sub,
      created_at: new Date().toISOString(),
    };
    db.submissions.unshift(row);
    if (db.submissions.length > 500) {
      db.submissions = db.submissions.slice(0, 500);
    }
    saveLocalDb();
    return row;
  },

  listSubmissions(limit = 200): SubmissionRow[] {
    const db = loadLocalDb();
    return db.submissions.slice(0, limit);
  },
};

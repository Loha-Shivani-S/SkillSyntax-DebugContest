import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Led, Panel, TerminalHeader } from "@/components/terminal";
import {
  adminLogin,
  adminOverview,
  adminParticipantAction,
  adminUpdateContest,
} from "@/lib/contest.functions";
import { QUESTIONS, TOTAL_POINTS, type Question } from "@/lib/questions";
import { formatClock } from "@/lib/participant";

const TITLE = "Control Room — SYSTEM FAILURE Contest Administration";
const DESCRIPTION =
  "Contest control room: contest state machine, leaderboard freeze and publish toggles, participant management, question management, and submission inspection.";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminPage,
});

const PHASES = ["draft", "ready", "live", "ended", "published"] as const;
const KEY = "sysfail.admin";

function AdminPage() {
  const login = useServerFn(adminLogin);
  const overview = useServerFn(adminOverview);
  const update = useServerFn(adminUpdateContest);
  const act = useServerFn(adminParticipantAction);

  const [passcode, setPasscode] = useState("");
  const [authed, setAuthed] = useState(false);
  const [openSubmission, setOpenSubmission] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [activeTab, setActiveTab] = useState<"participants" | "questions" | "submissions">("participants");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(KEY);
    if (!stored) return;
    setPasscode(stored);
    login({ data: { passcode: stored } }).then((r) => setAuthed(r.ok));
  }, [login]);

  const data = useQuery({
    queryKey: ["admin", authed],
    enabled: authed,
    refetchInterval: 10000,
    queryFn: () => overview({ data: { passcode } }),
  });

  const patch = useMutation({
    mutationFn: (input: Record<string, unknown>) => update({ data: { passcode, ...input } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Contest state updated");
      await data.refetch();
    },
  });

  const participantAction = useMutation({
    mutationFn: (input: { participantId: string; action: "suspend" | "restore" | "delete" | "reset" | "clear_violations" }) =>
      act({ data: { passcode, ...input } }),
    onSuccess: async () => {
      toast.success("Participant record updated");
      await data.refetch();
    },
  });

  const payload = data.data?.ok ? data.data : null;
  const clock = payload?.clock;
  const participants = payload?.participants ?? [];
  const progress = payload?.progress ?? [];
  const submissions = payload?.submissions ?? [];

  const scoreFor = (id: string) =>
    (progress as any[]).filter((p) => p.participant_id === id).reduce((sum, p) => sum + (p.best_score || 0), 0);
  const solvedFor = (id: string) =>
    (progress as any[]).filter((p) => p.participant_id === id && p.status === "solved").length;

  function exportCSV() {
    if (participants.length === 0) {
      toast.error("No participant data to export");
      return;
    }

    const headers = [
      "Rank",
      "Participant Code",
      "Full Name",
      "College",
      "Department",
      "Year",
      "Register Number",
      "Email",
      "Score",
      "Solved",
      "Tab Switches",
      "Away Time (s)",
      "Status",
      "Enrolled At",
    ];

    // Sort participants by score descending
    const sorted = [...participants].sort((a, b) => {
      const scoreA = scoreFor(a.id);
      const scoreB = scoreFor(b.id);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return solvedFor(b.id) - solvedFor(a.id);
    });

    const rows = sorted.map((p, idx) => [
      idx + 1,
      `"${p.participant_code}"`,
      `"${p.full_name}"`,
      `"${p.college}"`,
      `"${p.department}"`,
      `"${p.year}"`,
      `"${p.register_number}"`,
      `"${p.email}"`,
      scoreFor(p.id),
      solvedFor(p.id),
      (p as any).tab_switch_count ?? 0,
      (p as any).away_duration_seconds ?? 0,
      p.disqualified ? "SUSPENDED" : "ACTIVE",
      `"${p.created_at}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SYSTEM_FAILURE_SCORES_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export downloaded");
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <TerminalHeader variant="admin" />

        <main className="mx-auto max-w-md px-4 py-16 sm:py-24">
          <Panel title="Control Room Authentication">
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                const result = await login({ data: { passcode } });
                if (result.ok) {
                  window.sessionStorage.setItem(KEY, passcode);
                  setAuthed(true);
                } else {
                  toast.error("Passcode rejected");
                }
              }}
            >
              <label className="block text-[10px] tracking-widest text-muted-foreground">
                CONTROL ROOM PASSCODE
                <input
                  type="password"
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  className="mt-1 w-full rounded-sm border border-input bg-background/70 px-3 py-2.5 font-mono text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                />
              </label>
              <button className="console-button glow-ok w-full rounded-sm bg-primary px-4 py-3 text-primary-foreground font-bold tracking-wider">
                ▸ AUTHENTICATE
              </button>
              <p className="text-[10px] tracking-wider text-muted-foreground">
                Default passcode: RECOVER-2026 (configured via ADMIN_PASSCODE environment variable).
              </p>
            </form>
          </Panel>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TerminalHeader
        variant="admin"
        onSignOut={() => {
          window.sessionStorage.removeItem(KEY);
          setPasscode("");
          setAuthed(false);
        }}
      />

      <main className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        {/* System & Database Health Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/80 bg-panel/40 px-4 py-2 text-xs font-mono">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-[10px] tracking-widest text-muted-foreground uppercase">DATABASE ENGINE:</span>
            {(payload as any)?.storageBackend === "supabase" ? (
              <span className="inline-flex items-center gap-1.5 rounded bg-status-ok/15 border border-status-ok/40 px-2 py-0.5 text-[10px] font-bold text-status-ok">
                <span className="size-1.5 rounded-full bg-status-ok animate-pulse" />
                CLOUD SUPABASE CONNECTED (LIVE)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded bg-status-warn/15 border border-status-warn/40 px-2 py-0.5 text-[10px] font-bold text-status-warn">
                <span className="size-1.5 rounded-full bg-status-warn" />
                LOCAL FALLBACK (IN-MEMORY)
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground tracking-wider">
            ADMIN STATUS: VERIFIED · DRILL 2026
          </span>
        </div>

        {/* Top Stat Panels */}
        <div className="grid gap-4 md:grid-cols-3">
          <Panel
            title="Contest State Machine"
            right={
              <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground font-mono">
                <Led tone={clock?.state === "live" ? "ok" : "warn"} />
                {(clock?.state ?? "—").toUpperCase()}
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              {PHASES.map((phase) => (
                <button
                  key={phase}
                  onClick={() => patch.mutate({ state: phase })}
                  className={`rounded border px-3 py-2 text-[10px] tracking-widest font-mono transition ${
                    clock?.state === phase
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {phase.toUpperCase()}
                </button>
              ))}
              <button
                onClick={() => patch.mutate({ state: "live", restartClock: true })}
                className="rounded border border-status-warn/60 px-3 py-2 text-[10px] tracking-widest font-mono text-status-warn hover:bg-status-warn/10"
              >
                RESTART CLOCK
              </button>
            </div>
          </Panel>

          <Panel title="Recovery Window">
            <p className="text-3xl font-bold tabular-nums text-primary text-glow font-mono">
              {formatClock(clock?.remainingSeconds ?? 0)}
            </p>
            <label className="mt-3 block text-[10px] tracking-widest text-muted-foreground font-mono">
              DURATION (MINUTES)
              <input
                type="number"
                min={5}
                max={600}
                defaultValue={Math.round((clock?.durationSeconds ?? 5400) / 60)}
                onBlur={(event) =>
                  patch.mutate({ durationSeconds: Number(event.target.value) * 60 })
                }
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
            </label>
          </Panel>

          <Panel title="Results & Leaderboard Control">
            <div className="space-y-2">
              <button
                onClick={() => patch.mutate({ leaderboardFrozen: !clock?.leaderboardFrozen })}
                className="w-full rounded border border-border px-3 py-2 text-[10px] font-mono tracking-widest hover:border-primary hover:text-primary transition"
              >
                LEADERBOARD: {clock?.leaderboardFrozen ? "FROZEN — UNFREEZE" : "LIVE — FREEZE"}
              </button>
              <button
                onClick={() => patch.mutate({ resultsPublished: !clock?.resultsPublished })}
                className="w-full rounded border border-border px-3 py-2 text-[10px] font-mono tracking-widest hover:border-primary hover:text-primary transition"
              >
                RESULTS: {clock?.resultsPublished ? "PUBLISHED — RETRACT" : "HELD — PUBLISH"}
              </button>
              <button
                onClick={exportCSV}
                className="w-full rounded bg-primary/20 border border-primary px-3 py-2 text-[10px] font-mono font-bold tracking-widest text-primary hover:bg-primary/30 transition flex items-center justify-center gap-2"
              >
                📥 EXPORT RESULTS TO CSV
              </button>
            </div>
          </Panel>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/80">
          <button
            onClick={() => setActiveTab("participants")}
            className={`px-4 py-2.5 text-xs font-mono tracking-widest transition border-b-2 -mb-px ${
              activeTab === "participants"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            PARTICIPANTS ({participants.length})
          </button>
          <button
            onClick={() => setActiveTab("questions")}
            className={`px-4 py-2.5 text-xs font-mono tracking-widest transition border-b-2 -mb-px ${
              activeTab === "questions"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            QUESTIONS ({QUESTIONS.length} — {TOTAL_POINTS} PTS)
          </button>
          <button
            onClick={() => setActiveTab("submissions")}
            className={`px-4 py-2.5 text-xs font-mono tracking-widest transition border-b-2 -mb-px ${
              activeTab === "submissions"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            SUBMISSION AUDIT ({submissions.length})
          </button>
        </div>

        {/* Tab Content: Participants */}
        {activeTab === "participants" && (
          <Panel
            title="Participant Registry & Live Scoring"
            right={
              <button
                onClick={exportCSV}
                className="console-button rounded-sm border border-primary px-2.5 py-1 text-[10px] font-mono text-primary hover:bg-primary/10"
              >
                EXPORT CSV
              </button>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="text-[10px] tracking-widest text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3">RANK</th>
                    <th className="py-2 pr-3">OPERATOR ID</th>
                    <th className="py-2 pr-3">NAME</th>
                    <th className="py-2 pr-3">REG NO</th>
                    <th className="py-2 pr-3">DEPT / YEAR</th>
                    <th className="py-2 pr-3">VIOLATIONS</th>
                    <th className="py-2 pr-3 text-right">SCORE</th>
                    <th className="py-2 pr-3 text-right">SOLVED</th>
                    <th className="py-2">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {[...participants]
                    .sort((a, b) => scoreFor(b.id) - scoreFor(a.id))
                    .map((p, idx) => {
                      const switchCount = (p as any).tab_switch_count ?? 0;
                      const awaySeconds = (p as any).away_duration_seconds ?? 0;

                      return (
                        <tr key={p.id} className="border-b border-border/60 hover:bg-accent/10">
                          <td className="py-2 pr-3 font-bold text-muted-foreground">#{idx + 1}</td>
                          <td className="py-2 pr-3 font-semibold text-primary">{p.participant_code}</td>
                          <td className="py-2 pr-3">
                            {p.full_name}
                            {p.disqualified && <span className="ml-2 text-status-fail font-bold">[SUSPENDED]</span>}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground">{p.register_number}</td>
                          <td className="py-2 pr-3 text-muted-foreground">
                            {p.department} · Y{p.year}
                          </td>
                          <td className="py-2 pr-3">
                            {p.disqualified ? (
                              <span className="inline-flex items-center gap-1 rounded bg-status-fail/20 border border-status-fail/40 px-1.5 py-0.5 text-[9px] font-bold text-status-fail">
                                ⛔ SUSPENDED ({switchCount} strikes · {awaySeconds}s)
                              </span>
                            ) : switchCount > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded bg-status-warn/20 border border-status-warn/40 px-1.5 py-0.5 text-[9px] font-bold text-status-warn">
                                ⚠️ STRIKE {switchCount}/3 ({awaySeconds}s away)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-status-ok/10 border border-status-ok/30 px-1.5 py-0.5 text-[9px] font-semibold text-status-ok">
                                ✓ CLEAN (0)
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-bold text-primary">
                            {scoreFor(p.id)} / {TOTAL_POINTS}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums text-status-ok">
                            {solvedFor(p.id)} / {QUESTIONS.length}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {(switchCount > 0 || p.disqualified) && (
                                <button
                                  onClick={() =>
                                    participantAction.mutate({
                                      participantId: p.id,
                                      action: "clear_violations",
                                    })
                                  }
                                  title="Clear violations and remove suspension"
                                  className="rounded border border-status-warn/60 bg-status-warn/10 px-2 py-0.5 text-[9px] tracking-widest text-status-warn hover:bg-status-warn/20"
                                >
                                  CLEAR STRIKES
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  participantAction.mutate({
                                    participantId: p.id,
                                    action: p.disqualified ? "restore" : "suspend",
                                  })
                                }
                                className="rounded border border-border px-2 py-0.5 text-[9px] tracking-widest hover:border-status-warn hover:text-status-warn"
                              >
                                {p.disqualified ? "RESTORE" : "SUSPEND"}
                              </button>
                              <button
                                onClick={() =>
                                  participantAction.mutate({ participantId: p.id, action: "reset" })
                                }
                                className="rounded border border-border px-2 py-0.5 text-[9px] tracking-widest hover:border-primary hover:text-primary"
                              >
                                RESET
                              </button>
                              <button
                                onClick={() =>
                                  participantAction.mutate({ participantId: p.id, action: "delete" })
                                }
                                className="rounded border border-border px-2 py-0.5 text-[9px] tracking-widest hover:border-status-fail hover:text-status-fail"
                              >
                                DELETE
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {participants.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground font-mono">
                  No operators enrolled yet. Participants will appear here after registering.
                </p>
              )}
            </div>
          </Panel>
        )}

        {/* Tab Content: Question Management */}
        {activeTab === "questions" && (
          <div className="space-y-4">
            <Panel title="Question & Challenge Suite (12 EIE Subsystems — 100 Points)">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="text-[10px] tracking-widest text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3">CODE</th>
                      <th className="py-2 pr-3">CHALLENGE TITLE</th>
                      <th className="py-2 pr-3">SUBSYSTEM</th>
                      <th className="py-2 pr-3">DIFFICULTY</th>
                      <th className="py-2 pr-3 text-right">POINTS</th>
                      <th className="py-2 pr-3 text-right">TEST CASES</th>
                      <th className="py-2">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {QUESTIONS.map((q) => (
                      <tr key={q.id} className="border-b border-border/60 hover:bg-accent/10">
                        <td className="py-2 pr-3 font-bold text-primary">{q.codename}</td>
                        <td className="py-2 pr-3 font-medium text-foreground">{q.title}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{q.subsystem}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-widest ${
                              q.difficulty === "LOW"
                                ? "bg-status-ok/10 text-status-ok"
                                : q.difficulty === "MEDIUM"
                                  ? "bg-status-warn/10 text-status-warn"
                                  : q.difficulty === "HIGH"
                                    ? "bg-amber-500/10 text-amber-500"
                                    : "bg-status-fail/10 text-status-fail"
                            }`}
                          >
                            {q.difficulty}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right font-bold text-primary tabular-nums">
                          {q.points} pts
                        </td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">
                          {q.tests.filter((t) => !t.hidden).length} visible +{" "}
                          {q.tests.filter((t) => t.hidden).length} hidden
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => setSelectedQuestion(selectedQuestion?.id === q.id ? null : q)}
                            className="rounded border border-border px-2.5 py-0.5 text-[10px] tracking-wider hover:border-primary hover:text-primary transition"
                          >
                            {selectedQuestion?.id === q.id ? "CLOSE" : "INSPECT"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            {selectedQuestion && (
              <Panel
                title={`Inspecting ${selectedQuestion.codename}: ${selectedQuestion.title}`}
                right={
                  <button
                    onClick={() => setSelectedQuestion(null)}
                    className="console-button rounded border border-border px-2 py-0.5 text-[10px]"
                  >
                    CLOSE
                  </button>
                }
              >
                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <h4 className="text-[10px] tracking-widest text-primary">PROBLEM STATEMENT</h4>
                    <p className="mt-1 text-foreground leading-relaxed">{selectedQuestion.statement}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] tracking-widest text-primary">I/O SPECIFICATION</h4>
                    <pre className="mt-1 whitespace-pre-wrap rounded bg-background/80 p-2 text-muted-foreground border border-border">
                      {selectedQuestion.ioSpec}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-[10px] tracking-widest text-status-warn">HINT</h4>
                    <p className="mt-1 text-muted-foreground italic">{selectedQuestion.hint}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] tracking-widest text-primary">BROKEN STARTER C FIRMWARE</h4>
                    <pre className="mt-1 max-h-56 overflow-auto whitespace-pre rounded bg-background/90 p-2.5 text-foreground border border-border">
                      {selectedQuestion.brokenCode}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-[10px] tracking-widest text-primary">
                      EVALUATION TEST CASES ({selectedQuestion.tests.length} TOTAL)
                    </h4>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedQuestion.tests.map((t, i) => (
                        <div key={i} className="rounded border border-border/70 bg-background/50 p-2.5">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold text-foreground">{t.label}</span>
                            <span
                              className={`rounded px-1 text-[9px] ${
                                t.hidden ? "bg-amber-500/10 text-amber-400" : "bg-status-ok/10 text-status-ok"
                              }`}
                            >
                              {t.hidden ? "HIDDEN TEST" : "VISIBLE TEST"}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] text-muted-foreground">STDIN:</p>
                          <pre className="text-[10px] text-foreground">{t.stdin || "(empty)"}</pre>
                          <p className="mt-1 text-[10px] text-muted-foreground">EXPECTED:</p>
                          <pre className="text-[10px] text-status-ok">{t.expected}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* Tab Content: Submissions */}
        {activeTab === "submissions" && (
          <Panel title="Submission Inspection (latest 200)">
            <div className="space-y-2 font-mono">
              {(submissions as any[]).map((s) => {
                const operator = (participants as any[]).find((p) => p.id === s.participant_id);
                const open = openSubmission === s.id;
                return (
                  <div key={s.id} className="rounded border border-border">
                    <button
                      onClick={() => setOpenSubmission(open ? null : s.id)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-[11px]"
                    >
                      <span className="flex items-center gap-2">
                        <Led tone={s.compile_error ? "fail" : s.passed === s.total ? "ok" : "warn"} />
                        <span className="font-semibold text-primary">
                          {operator?.participant_code ?? "—"}
                        </span>
                        <span className="text-muted-foreground">Q{s.question_id}</span>
                        <span className="text-[10px] tracking-widest text-status-idle font-bold">
                          {s.kind.toUpperCase()}
                        </span>
                      </span>
                      <span className="text-[10px] tracking-widest text-muted-foreground">
                        {s.passed}/{s.total} PASSED · {s.score} PTS ·{" "}
                        {s.created_at.replace("T", " ").slice(0, 19)}
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-border p-3 bg-background/60">
                        {s.compile_error && (
                          <pre className="mb-2 whitespace-pre-wrap text-[10px] text-status-fail">
                            {s.compile_error}
                          </pre>
                        )}
                        <pre className="max-h-72 overflow-auto whitespace-pre text-[11px] text-foreground">
                          {s.code}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
              {submissions.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">No submissions recorded yet.</p>
              )}
            </div>
          </Panel>
        )}
      </main>
    </div>
  );
}

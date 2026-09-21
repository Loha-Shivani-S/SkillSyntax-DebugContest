import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Led, Panel, TerminalHeader } from "@/components/terminal";
import { CONTEST_MINUTES, QUESTIONS, TOTAL_POINTS } from "@/lib/questions";
import { getContestClock } from "@/lib/contest.functions";

const TITLE = "SYSTEM FAILURE — Hardware × Software Debugging Challenge";
const DESCRIPTION =
  "A 90-minute C debugging contest for 2nd-year Electronics & Instrumentation students: 12 broken subsystems, 100 points, one plant to bring back online.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Landing,
});

const PHASE_COPY: Record<string, { tone: "ok" | "warn" | "fail" | "idle"; text: string }> = {
  draft: { tone: "idle", text: "SYSTEM OFFLINE — CONTEST IN DRAFT" },
  ready: { tone: "warn", text: "STANDBY — REGISTRATION OPEN" },
  live: { tone: "ok", text: "CONTEST LIVE — DIAGNOSTICS RUNNING" },
  ended: { tone: "fail", text: "CONTEST ENDED — CONSOLE LOCKED" },
  published: { tone: "ok", text: "RESULTS PUBLISHED" },
};

function Landing() {
  const clock = useQuery({
    queryKey: ["clock"],
    queryFn: () => getContestClock(),
    refetchInterval: 20000,
  });

  const phase = PHASE_COPY[clock.data?.state ?? "draft"] ?? PHASE_COPY["draft"]!;

  return (
    <div className="min-h-screen">
      <TerminalHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="panel-frame corner-frame relative overflow-hidden rounded-sm p-6 sm:p-12">
          <div className="absolute inset-x-0 top-0 h-px bg-status-fail/80" />
          <div className="absolute right-6 top-6 hidden font-mono text-[9px] tracking-[0.18em] text-muted-foreground/70 sm:block">
            NODE_01 / AUTH_LEVEL_04
          </div>
          <p className="terminal-kicker flex items-center gap-2 text-muted-foreground">
            <Led tone={phase.tone} />
            {phase.text}
          </p>

          <h1 className="animate-flicker mt-7 max-w-4xl font-sans text-4xl font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-foreground sm:text-7xl">
            SYSTEM <span className="text-status-fail text-glow">FAILURE</span>
          </h1>
          <p className="mt-4 scanline-title text-[11px] text-primary sm:text-sm">
            Hardware × Software Debugging Challenge
          </p>

          <p className="mt-8 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            At 02:14 the plant supervisory layer went dark. Twelve instrumentation subsystems —
            sensors, controllers, alarms, loggers — are running defective C firmware. Your job is not
            to write new code. Your job is to read broken code, find the fault, and bring each
            subsystem back online before the recovery window closes.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: "RECOVERY WINDOW", v: `${CONTEST_MINUTES} MIN` },
              { k: "SUBSYSTEMS", v: `${QUESTIONS.length} FAULTS` },
              { k: "MAX SCORE", v: `${TOTAL_POINTS} PTS` },
              { k: "LANGUAGE", v: "C (GCC)" },
            ].map((item) => (
              <div key={item.k} className="rounded-sm border border-border/80 bg-background/35 px-3 py-3.5">
                <dt className="terminal-kicker text-muted-foreground">{item.k}</dt>
                <dd className="mt-2 font-mono text-lg font-semibold text-primary text-glow">{item.v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="console-button glow-ok inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3.5 text-primary-foreground transition hover:brightness-110 active:translate-y-px"
            >
              ▸ ENTER CONTEST
            </Link>
            <Link
              to="/leaderboard"
              className="console-button inline-flex items-center gap-2 rounded-sm border border-border px-6 py-3.5 text-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary"
            >
              VIEW STANDINGS
            </Link>
          </div>
        </section>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Panel title="Rules of Engagement">
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>▸ Every problem ships pre-loaded with broken C firmware.</li>
              <li>▸ RUN checks your fix against visible bench tests only.</li>
              <li>▸ SUBMIT checks visible + hidden field tests and locks in partial credit.</li>
              <li>▸ Best score per subsystem is kept — resubmitting never lowers you.</li>
              <li>▸ The clock is server-synchronised. Refreshing does not buy you time.</li>
            </ul>
          </Panel>

          <Panel title="Fault Manifest">
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              {QUESTIONS.slice(0, 6).map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="text-primary">{q.codename}</span> {q.title}
                  </span>
                  <span className="text-[10px] text-status-idle">{q.points} PTS</span>
                </li>
              ))}
              <li className="text-status-idle">… 6 further subsystems classified until launch</li>
            </ol>
          </Panel>

          <Panel title="Scoring Curve">
            <div className="space-y-2">
              {QUESTIONS.map((q) => (
                <div key={q.id} className="flex items-center gap-2">
                  <span className="w-8 text-[10px] text-muted-foreground">{q.codename}</span>
                  <div className="h-1.5 flex-1 rounded bg-muted">
                    <div
                      className="h-full rounded bg-primary/80"
                      style={{ width: `${(q.points / 15) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[10px] text-muted-foreground">
                    {q.points}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </main>

      <footer className="flex flex-col items-center gap-2 border-t border-border py-6 text-center text-[10px] tracking-widest text-muted-foreground">
        <span>ELECTRONICS &amp; INSTRUMENTATION ENGINEERING · SYSTEM RECOVERY DRILL 2026</span>
        <Link to="/admin" className="text-muted-foreground/60 transition-colors hover:text-primary">
          STAFF CONTROL ROOM
        </Link>
      </footer>
    </div>
  );
}

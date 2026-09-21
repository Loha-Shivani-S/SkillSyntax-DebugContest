import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Led, Panel, StatusChip, TerminalHeader, type QuestionStatus } from "@/components/terminal";
import { ProctoringShield } from "@/components/ProctoringShield";
import { QUESTIONS, TOTAL_POINTS } from "@/lib/questions";
import { getParticipantSnapshot } from "@/lib/contest.functions";
import { formatClock, useParticipant } from "@/lib/participant";

const TITLE = "Recovery Console — SYSTEM FAILURE Debugging Challenge";
const DESCRIPTION =
  "Live recovery console: server-synchronised 90-minute timer, score tracker and the status of all twelve faulty instrumentation subsystems.";

export const Route = createFileRoute("/contest/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const { participant, ready, signOut } = useParticipant();
  const fetchSnapshot = useServerFn(getParticipantSnapshot);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (ready && !participant) navigate({ to: "/register" });
  }, [ready, participant, navigate]);

  const snapshot = useQuery({
    queryKey: ["snapshot", participant?.id],
    enabled: Boolean(participant?.id),
    refetchInterval: 15000,
    queryFn: () => fetchSnapshot({ data: { participantId: participant!.id } }),
  });

  const data = snapshot.data?.ok ? snapshot.data : null;

  useEffect(() => {
    if (!data) return;
    setRemaining(data.clock.remainingSeconds);
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const statusFor = (questionId: number): QuestionStatus =>
    (data?.progress.find((p) => p.questionId === questionId)?.status as QuestionStatus) ??
    "not_attempted";

  const phase = data?.clock.state ?? "draft";
  const isLive = phase === "live" && remaining > 0;
  const solved = data?.solved ?? 0;

  useEffect(() => {
    if (solved === QUESTIONS.length) navigate({ to: "/recovery" });
  }, [solved, navigate]);

  if (snapshot.data && !snapshot.data.ok) {
    return (
      <div className="min-h-screen">
        <TerminalHeader />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <Panel title="Access Denied">
            <p className="text-sm text-status-fail">
              This access record is no longer recognised by the control room.
            </p>
            <button
              onClick={() => {
                signOut();
                navigate({ to: "/register" });
              }}
              className="mt-4 rounded border border-border px-4 py-2 text-xs tracking-widest hover:border-primary hover:text-primary"
            >
              RE-ENROL
            </button>
          </Panel>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ProctoringShield
        participantId={participant?.id}
        participantName={data?.participant.name}
        rollNo={participant?.code}
        isLive={isLive}
        initialDisqualified={data?.participant.disqualified}
      />
      <TerminalHeader
        right={
          <button onClick={signOut} className="hover:text-status-fail">
            SIGN OUT
          </button>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Panel title="Recovery Window">
            <p
              className={`font-mono text-4xl font-bold tabular-nums ${
                remaining <= 300 && isLive ? "text-status-fail text-glow" : "text-primary text-glow"
              }`}
            >
              {formatClock(remaining)}
            </p>
            <p className="mt-2 text-[10px] tracking-widest text-muted-foreground">
              SERVER SYNCHRONISED
            </p>
          </Panel>

          <Panel title="Score">
            <p className="font-mono text-4xl font-bold tabular-nums text-accent text-glow">
              {data?.score ?? 0}
              <span className="text-lg text-muted-foreground"> / {TOTAL_POINTS}</span>
            </p>
            <p className="mt-2 text-[10px] tracking-widest text-muted-foreground">PARTIAL CREDIT APPLIED</p>
          </Panel>

          <Panel title="Subsystems Online">
            <p className="font-mono text-4xl font-bold tabular-nums text-status-ok text-glow">
              {solved}
              <span className="text-lg text-muted-foreground"> / {QUESTIONS.length}</span>
            </p>
            <p className="mt-2 text-[10px] tracking-widest text-muted-foreground">SOLVED FAULTS</p>
          </Panel>

          <Panel title="Operator">
            <p className="font-mono text-lg font-semibold text-foreground">{data?.participant.code ?? "—"}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{data?.participant.name}</p>
            <p className="mt-3 flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
              <Led tone={isLive ? "ok" : phase === "ended" || phase === "published" ? "fail" : "warn"} />
              {isLive ? "CONTEST LIVE" : phase === "ready" ? "STANDBY" : phase.toUpperCase()}
            </p>
          </Panel>
        </div>

        {!isLive && (
          <div className="panel-frame mt-4 rounded-sm border-status-warn/50 px-4 py-3 text-xs text-status-warn">
            {phase === "ready" || phase === "draft"
              ? "The recovery window has not opened. The control room will bring the contest live — keep this console open."
              : "The recovery window is closed. Code execution is locked; your scores are final."}
          </div>
        )}

        <Panel className="mt-4" title="Fault Grid — Q1 … Q12">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUESTIONS.map((q) => {
              const status = statusFor(q.id);
              const best = data?.progress.find((p) => p.questionId === q.id)?.bestScore ?? 0;
              return (
                <Link
                  key={q.id}
                  to="/contest/$qid"
                  params={{ qid: String(q.id) }}
                  className="panel-frame group rounded-sm p-4 transition hover:border-primary hover:bg-primary/[0.03]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-primary">{q.codename}</span>
                    <span className="text-[10px] tracking-widest text-muted-foreground">
                      {best}/{q.points} PTS
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-foreground group-hover:text-primary">{q.title}</p>
                  <p className="mt-1 truncate text-[10px] tracking-wider text-muted-foreground">
                    {q.subsystem}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <StatusChip status={status} />
                    <span className="text-[10px] tracking-widest text-status-idle">{q.difficulty}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>
      </main>
    </div>
  );
}

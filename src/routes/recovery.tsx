import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

import { Led, Panel, TerminalHeader } from "@/components/terminal";
import { getParticipantSnapshot } from "@/lib/contest.functions";
import { QUESTIONS, TOTAL_POINTS } from "@/lib/questions";
import { useParticipant } from "@/lib/participant";

const TITLE = "System Recovery Complete — SYSTEM FAILURE Challenge";
const DESCRIPTION =
  "All twelve instrumentation subsystems restored. Final recovery report for the SYSTEM FAILURE debugging challenge.";

export const Route = createFileRoute("/recovery")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: RecoveryPage,
});

function RecoveryPage() {
  const { participant } = useParticipant();
  const fetchSnapshot = useServerFn(getParticipantSnapshot);

  const snapshot = useQuery({
    queryKey: ["snapshot", participant?.id],
    enabled: Boolean(participant?.id),
    queryFn: () => fetchSnapshot({ data: { participantId: participant!.id } }),
  });

  const data = snapshot.data?.ok ? snapshot.data : null;
  const solved = data?.solved ?? 0;
  const complete = solved === QUESTIONS.length;

  return (
    <div className="min-h-screen">
      <TerminalHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <section className="panel-frame corner-frame rounded-sm p-8 text-center sm:p-12">
          <p className="flex items-center justify-center gap-2 text-[11px] tracking-[0.3em] text-muted-foreground">
            <Led tone={complete ? "ok" : "warn"} />
            {complete ? "ALL SUBSYSTEMS ONLINE" : "RECOVERY IN PROGRESS"}
          </p>
          <h1
            className={`mt-6 text-3xl font-bold sm:text-5xl ${
              complete ? "text-status-ok text-glow" : "text-status-warn text-glow"
            }`}
          >
            {complete ? "✔ SYSTEM RECOVERED" : "⚠ PARTIAL RECOVERY"}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {complete
              ? "Every sensor, controller, alarm and logger is reporting nominal. The plant is back under supervisory control."
              : "Some subsystems are still reporting faults. Return to the console and keep debugging."}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-sm border border-border bg-background/35 px-4 py-4">
              <p className="text-[10px] tracking-widest text-muted-foreground">FINAL SCORE</p>
              <p className="mt-1 text-2xl font-bold text-accent">
                {data?.score ?? 0}/{TOTAL_POINTS}
              </p>
            </div>
            <div className="rounded-sm border border-border bg-background/35 px-4 py-4">
              <p className="text-[10px] tracking-widest text-muted-foreground">SUBSYSTEMS</p>
              <p className="mt-1 text-2xl font-bold text-status-ok">
                {solved}/{QUESTIONS.length}
              </p>
            </div>
            <div className="rounded-sm border border-border bg-background/35 px-4 py-4">
              <p className="text-[10px] tracking-widest text-muted-foreground">OPERATOR</p>
              <p className="mt-1 text-lg font-bold text-primary">{data?.participant.code ?? "—"}</p>
            </div>
          </div>

          <div className="mt-8 space-y-1.5 text-left">
            {QUESTIONS.map((q) => {
              const row = data?.progress.find((p) => p.questionId === q.id);
              const ok = row?.status === "solved";
              return (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Led tone={ok ? "ok" : row ? "warn" : "fail"} />
                    <span className="text-muted-foreground">{q.codename}</span>
                    <span className="text-foreground">{q.subsystem}</span>
                  </span>
                  <span className={ok ? "text-status-ok" : "text-status-fail"}>
                    {ok ? "ONLINE" : "FAULT"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/leaderboard"
              className="console-button glow-ok rounded-sm bg-primary px-6 py-3 text-primary-foreground"
            >
              VIEW STANDINGS
            </Link>
            <Link
              to="/contest"
              className="console-button rounded-sm border border-border px-6 py-3 hover:border-primary hover:text-primary"
            >
              BACK TO CONSOLE
            </Link>
          </div>
        </section>

        <Panel className="mt-6" title="Recovery Log">
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
            {[
              "> supervisory.link  ... RESTORED",
              "> sensor.bus        ... NOMINAL",
              "> controller.loop   ... NOMINAL",
              "> annunciator       ... ARMED",
              "> datalogger        ... WRITING",
              complete ? "> plant.status      ... RECOVERED" : "> plant.status      ... DEGRADED",
            ].join("\n")}
          </pre>
        </Panel>
      </main>
    </div>
  );
}

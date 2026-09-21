import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Led, Panel, TerminalHeader } from "@/components/terminal";
import { getLeaderboard } from "@/lib/contest.functions";
import { TOTAL_POINTS } from "@/lib/questions";

const TITLE = "Live Standings — SYSTEM FAILURE Debugging Challenge";
const DESCRIPTION =
  "Real-time leaderboard for the SYSTEM FAILURE contest: rank, participant ID, score, subsystems recovered and tie-break timestamps.";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const board = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => getLeaderboard(),
    refetchInterval: 8000,
  });

  const rows = board.data?.rows ?? [];
  const frozen = board.data?.frozen ?? false;

  return (
    <div className="min-h-screen">
      <TerminalHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        <Panel
          title="Plant Recovery Standings"
          right={
            <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
              <Led tone={frozen ? "warn" : "ok"} />
              {frozen ? "FEED FROZEN" : "LIVE FEED · 8s"}
            </span>
          }
        >
          {frozen ? (
            <p className="py-10 text-center text-sm text-status-warn">
              The control room has frozen the standings feed. Results will be released after the
              recovery window closes.
            </p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No operators enrolled yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-background/30 text-[10px] tracking-widest text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2.5 pr-3">RANK</th>
                    <th className="py-2.5 pr-3">NAME</th>
                    <th className="py-2.5 pr-3">ROLL NO</th>
                    <th className="py-2.5 pr-3 text-right">SCORE</th>
                    <th className="py-2.5 text-right">SOLVED</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.rollNo || row.participantCode} className="border-b border-border/60 transition-colors hover:bg-primary/[0.04]">
                      <td className="py-2.5 pr-3">
                        <span
                          className={
                            row.rank <= 3
                              ? "font-bold text-accent text-glow"
                              : "text-muted-foreground"
                          }
                        >
                          #{String(row.rank).padStart(2, "0")}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-primary">{row.name}</td>
                      <td className="py-2.5 pr-3 text-foreground">{row.rollNo}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums font-bold text-foreground">
                        {row.score}
                        <span className="text-muted-foreground font-normal"> / {TOTAL_POINTS}</span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-status-ok font-semibold">
                        {row.solved}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-[10px] leading-relaxed tracking-wider text-muted-foreground">
            TIE-BREAK ORDER: total score ▸ subsystems recovered ▸ earliest final recovery timestamp.
          </p>
        </Panel>
      </main>
    </div>
  );
}

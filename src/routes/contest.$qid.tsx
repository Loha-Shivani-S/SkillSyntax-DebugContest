import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CodeEditor } from "@/components/CodeEditor";
import { ProctoringShield } from "@/components/ProctoringShield";
import { Led, Panel, StatusChip, TerminalHeader, type QuestionStatus } from "@/components/terminal";
import {
  getParticipantSnapshot,
  runCode,
  saveDraft,
  submitCode,
  type ExecutionReport,
} from "@/lib/contest.functions";
import { QUESTIONS, getQuestion } from "@/lib/questions";
import { formatClock, useParticipant } from "@/lib/participant";

export const Route = createFileRoute("/contest/$qid")({
  loader: ({ params }) => {
    const question = getQuestion(Number(params.qid));
    if (!question) throw notFound();
    return { questionId: question.id };
  },
  head: ({ loaderData }) => {
    const question = loaderData ? getQuestion(loaderData.questionId) : undefined;
    if (!question) {
      return {
        meta: [{ title: "Unknown subsystem" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${question.codename} ${question.title} — SYSTEM FAILURE`;
    const description = `${question.subsystem}: debug the broken C firmware for ${question.points} points.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: Workspace,
});

function Workspace() {
  const { qid } = Route.useParams();
  const questionId = Number(qid);
  const question = getQuestion(questionId)!;
  const navigate = useNavigate();
  const { participant, ready } = useParticipant();

  const fetchSnapshot = useServerFn(getParticipantSnapshot);
  const run = useServerFn(runCode);
  const submit = useServerFn(submitCode);
  const persist = useServerFn(saveDraft);

  const [code, setCode] = useState(question.brokenCode);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [report, setReport] = useState<ExecutionReport | null>(null);
  const [mode, setMode] = useState<"run" | "submit">("run");
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (ready && !participant) navigate({ to: "/register" });
  }, [ready, participant, navigate]);

  const snapshot = useQuery({
    queryKey: ["snapshot", participant?.id],
    enabled: Boolean(participant?.id),
    refetchInterval: 20000,
    queryFn: () => fetchSnapshot({ data: { participantId: participant!.id } }),
  });

  const data = snapshot.data?.ok ? snapshot.data : null;
  const progress = data?.progress.find((p) => p.questionId === questionId);

  useEffect(() => {
    if (!data || loadedFor === questionId) return;
    setCode(progress?.lastCode ?? question.brokenCode);
    setLoadedFor(questionId);
    setReport(null);
  }, [data, progress, question.brokenCode, questionId, loadedFor]);

  useEffect(() => {
    setLoadedFor(null);
  }, [questionId]);

  useEffect(() => {
    if (data) setRemaining(data.clock.remainingSeconds);
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  const isLive = (data?.clock.state ?? "draft") === "live" && remaining > 0;

  const execute = useMutation({
    mutationFn: async (kind: "run" | "submit") => {
      setMode(kind);
      const payload = { participantId: participant!.id, questionId, code };
      return kind === "run" ? run({ data: payload }) : submit({ data: payload });
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setReport(result.report);
      if (result.report.engineError) {
        toast.error(`Execution engine unavailable: ${result.report.engineError}`);
        return;
      }
      if (mode === "submit") {
        await snapshot.refetch();
        if (result.report.status === "solved") toast.success("Subsystem restored — all tests passed");
        else if (result.report.compileError) toast.error("Compilation failed — firmware rejected");
        else toast.warning(`Partial credit: ${result.report.passed}/${result.report.total} tests passed`);
      }
    },
    onError: () => toast.error("Could not reach the judge. Retry in a moment."),
  });

  const visibleTests = useMemo(() => question.tests.filter((t) => !t.hidden), [question]);
  const status = (progress?.status as QuestionStatus) ?? "not_attempted";

  const prev = QUESTIONS.find((q) => q.id === questionId - 1);
  const next = QUESTIONS.find((q) => q.id === questionId + 1);

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
          <span className="flex items-center gap-2 tabular-nums text-foreground">
            <Led tone={isLive ? "ok" : "fail"} />
            {formatClock(remaining)}
          </span>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-widest text-muted-foreground">
              {question.subsystem} · {question.difficulty} SEVERITY · {question.points} PTS
            </p>
            <h1 className="mt-1 text-xl font-bold text-foreground">
              <span className="text-primary">{question.codename}</span> {question.title}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <StatusChip status={status} />
            <Link
              to="/contest"
              className="console-button rounded-sm border border-border px-3 py-1.5 hover:border-primary hover:text-primary"
            >
              FAULT GRID
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div className="space-y-4">
            <Panel title="Fault Report">
              <p className="text-xs leading-relaxed text-muted-foreground">{question.statement}</p>
                <div className="mt-4 rounded-sm border border-border bg-background/35 p-3">
                <p className="text-[10px] tracking-widest text-muted-foreground">I/O CONTRACT</p>
                <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">
                  {question.ioSpec}
                </pre>
              </div>
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-[10px] tracking-widest text-accent">
                  ▸ DIAGNOSTIC HINT
                </summary>
                <p className="mt-2 leading-relaxed text-muted-foreground">{question.hint}</p>
              </details>
            </Panel>

            <Panel title="Bench Test Cases (visible)">
              <div className="space-y-3">
                {visibleTests.map((test, index) => (
                  <div key={index} className="rounded-sm border border-border bg-background/35 p-3">
                    <p className="text-[10px] tracking-widest text-muted-foreground">
                      CASE {index + 1} · {test.label}
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] text-status-idle">STDIN</p>
                        <pre className="mt-1 whitespace-pre-wrap text-[11px] text-foreground">
                          {test.stdin.trim()}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[10px] text-status-idle">EXPECTED STDOUT</p>
                        <pre className="mt-1 whitespace-pre-wrap text-[11px] text-status-ok">
                          {test.expected}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] tracking-wider text-muted-foreground">
                  {question.tests.length - visibleTests.length} hidden field tests run only on SUBMIT.
                </p>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel
              title="main.c — broken firmware"
              right={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setCode(question.brokenCode);
                      setReport(null);
                    }}
                    className="console-button rounded-sm border border-border px-2 py-1 hover:border-status-warn hover:text-status-warn"
                  >
                    RESET
                  </button>
                  <button
                    disabled={!participant}
                    onClick={async () => {
                      await persist({ data: { participantId: participant!.id, questionId, code } });
                      toast.success("Draft saved to the control room");
                    }}
                    className="console-button rounded-sm border border-border px-2 py-1 hover:border-primary hover:text-primary"
                  >
                    SAVE
                  </button>
                </div>
              }
            >
              <div className="h-[440px]">
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  readOnly={!isLive}
                  onSave={async () => {
                    if (participant) {
                      await persist({ data: { participantId: participant.id, questionId, code } });
                      toast.success("Draft saved (Ctrl+S)");
                    }
                  }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  disabled={!isLive || execute.isPending}
                  onClick={() => execute.mutate("run")}
                  className="rounded border border-primary px-5 py-2.5 text-xs font-bold tracking-widest text-primary transition hover:bg-primary/10 disabled:opacity-40"
                >
                  {execute.isPending && mode === "run" ? "COMPILING…" : "▸ RUN CODE"}
                </button>
                <button
                  disabled={!isLive || execute.isPending}
                  onClick={() => execute.mutate("submit")}
                  className="glow-ok rounded bg-primary px-5 py-2.5 text-xs font-bold tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
                >
                  {execute.isPending && mode === "submit" ? "EVALUATING…" : "⏎ SUBMIT CODE"}
                </button>
                {!isLive && (
                  <span className="self-center text-[10px] tracking-widest text-status-fail">
                    EXECUTION LOCKED — CONTEST NOT LIVE
                  </span>
                )}
              </div>
            </Panel>

            <Panel
              title="Compiler / Execution Output"
              right={
                report && !report.engineError ? (
                  <span className="text-[10px] tracking-widest text-muted-foreground">
                    {report.passed}/{report.total} PASSED · {report.score}/{report.maxScore} PTS
                  </span>
                ) : null
              }
            >
              {!report ? (
                <pre className="text-[11px] text-muted-foreground">
                  {"> awaiting build...\n> press RUN to compile against the bench tests"}
                </pre>
              ) : report.engineError ? (
                <pre className="text-[11px] text-status-fail">
                  {`> execution engine error: ${report.engineError}`}
                </pre>
              ) : report.compileError ? (
                <div>
                  <p className="text-[10px] tracking-widest text-status-fail">COMPILATION FAILED</p>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-status-fail">
                    {report.compileError}
                  </pre>
                </div>
              ) : (
                <div className="space-y-2">
                  {report.results.map((result, index) => (
                    <div
                      key={index}
                      className={`rounded border p-3 ${
                        result.passed ? "border-status-ok/50" : "border-status-fail/50"
                      }`}
                    >
                      <p className="flex items-center justify-between text-[10px] tracking-widest">
                        <span className="flex items-center gap-2">
                          <Led tone={result.passed ? "ok" : "fail"} />
                          {result.hidden ? "HIDDEN FIELD TEST" : `BENCH · ${result.label}`}
                        </span>
                        <span className={result.passed ? "text-status-ok" : "text-status-fail"}>
                          {result.passed ? "PASS" : result.timedOut ? "TIMEOUT" : "FAIL"}
                        </span>
                      </p>
                      {!result.hidden && !result.passed && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="text-[10px] text-status-idle">EXPECTED</p>
                            <pre className="whitespace-pre-wrap text-[11px] text-status-ok">
                              {result.expected}
                            </pre>
                          </div>
                          <div>
                            <p className="text-[10px] text-status-idle">YOUR STDOUT</p>
                            <pre className="whitespace-pre-wrap text-[11px] text-status-fail">
                              {result.actual || "(empty)"}
                            </pre>
                          </div>
                        </div>
                      )}
                      {result.stderr && (
                        <pre className="mt-2 whitespace-pre-wrap text-[10px] text-status-warn">
                          {result.stderr}
                        </pre>
                      )}
                    </div>
                  ))}
                  <p className="pt-2 text-[10px] tracking-widest text-muted-foreground">
                    EXECUTION SUMMARY · {report.passed} of {report.total} tests passed ·{" "}
                    {report.score}/{report.maxScore} points ·{" "}
                    {report.status.replace("_", " ").toUpperCase()}
                  </p>
                </div>
              )}
            </Panel>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-[10px] tracking-widest">
          {prev ? (
            <Link
              to="/contest/$qid"
              params={{ qid: String(prev.id) }}
              className="text-muted-foreground hover:text-primary"
            >
              ◂ {prev.codename} {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              to="/contest/$qid"
              params={{ qid: String(next.id) }}
              className="text-muted-foreground hover:text-primary"
            >
              {next.codename} {next.title} ▸
            </Link>
          ) : (
            <span />
          )}
        </div>
      </main>
    </div>
  );
}

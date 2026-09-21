import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Led, Panel, TerminalHeader } from "@/components/terminal";
import { registerParticipant } from "@/lib/contest.functions";
import { writeParticipant } from "@/lib/participant";

const TITLE = "Operator Enrolment — Kongu Engineering College EIE Challenge";
const DESCRIPTION =
  "Register for the SYSTEM FAILURE C debugging contest for 2nd-year Electronics and Instrumentation Engineering students at Kongu Engineering College.";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const register = useServerFn(registerParticipant);

  const [form, setForm] = useState({
    fullName: "",
    college: "Kongu Engineering College",
    department: "Electronics and Instrumentation Engineering",
    year: "2",
    registerNumber: "",
    email: "",
  });

  const [issued, setIssued] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const roll = form.registerNumber.trim().toUpperCase();
      const mail = form.email.trim().toLowerCase();

      // Format validations
      if (!/^(25EIR|25EIL|24EIR|24EIL)/i.test(roll)) {
        throw new Error("Roll Number must start with 25EIR or 25EIL (e.g., 25EIR055)");
      }

      if (!mail.endsWith("@kongu.edu")) {
        throw new Error("Email must be your official Kongu ID ending in @kongu.edu");
      }

      return register({
        data: {
          ...form,
          registerNumber: roll,
          email: mail,
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      writeParticipant({ id: result.participantId, code: result.participantCode });
      setIssued(result.participantCode);
      toast.success(result.returning ? "Existing access record restored" : "Access record created");
      setTimeout(() => navigate({ to: "/contest" }), 1600);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Enrolment failed. Check every field and retry.");
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TerminalHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14 font-mono">
        <Panel
          title="Operator Enrolment / Kongu EIE Access Record"
          right={
            <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
              <Led tone="warn" /> AUTHORISATION REQUIRED
            </span>
          }
        >
          {issued ? (
            <div className="space-y-4 py-8 text-center">
              <p className="text-[11px] tracking-widest text-muted-foreground">
                ACCESS RECORD ISSUED
              </p>
              <p className="text-4xl font-bold text-primary text-glow">{issued}</p>
              <p className="text-xs text-muted-foreground">
                Routing you to the recovery console…
              </p>
            </div>
          ) : (
            <div>
              {/* Locked Department & College Banner */}
              <div className="mb-6 rounded border border-primary/30 bg-primary/[0.04] p-3.5 text-xs">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-[10px] tracking-widest text-muted-foreground block">INSTITUTION</span>
                    <span className="font-semibold text-primary">Kongu Engineering College</span>
                  </div>
                  <div>
                    <span className="text-[10px] tracking-widest text-muted-foreground block">TARGET BATCH</span>
                    <span className="font-semibold text-primary">2nd Year EIE (25EIR / 25EIL)</span>
                  </div>
                </div>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate();
                }}
              >
                <div>
                  <label className="block text-[10px] tracking-widest text-muted-foreground mb-1">
                    FULL NAME
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Loha S"
                    value={form.fullName}
                    onChange={(event) => setForm((f) => ({ ...f, fullName: event.target.value }))}
                    className="w-full rounded-sm border border-input bg-background/70 px-3.5 py-2.5 font-mono text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-[10px] tracking-widest text-muted-foreground mb-1">
                      ROLL NUMBER (25EIR / 25EIL)
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. 25EIR055"
                      value={form.registerNumber}
                      onChange={(event) =>
                        setForm((f) => ({ ...f, registerNumber: event.target.value.toUpperCase() }))
                      }
                      className="w-full rounded-sm border border-input bg-background/70 px-3.5 py-2.5 font-mono text-sm text-foreground uppercase outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">Starts with 25EIR or 25EIL</p>
                  </div>

                  <div>
                    <label className="block text-[10px] tracking-widest text-muted-foreground mb-1">
                      KONGU STUDENT EMAIL
                    </label>
                    <input
                      required
                      type="email"
                      placeholder="username@kongu.edu"
                      value={form.email}
                      onChange={(event) => setForm((f) => ({ ...f, email: event.target.value }))}
                      className="w-full rounded-sm border border-input bg-background/70 px-3.5 py-2.5 font-mono text-sm text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">Must end in @kongu.edu</p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="console-button glow-ok w-full rounded-sm bg-primary px-4 py-3.5 text-primary-foreground font-bold tracking-widest transition hover:brightness-110 disabled:opacity-60"
                  >
                    {mutation.isPending ? "VALIDATING & ISSUING ACCESS…" : "▸ REQUEST ACCESS"}
                  </button>
                  <p className="mt-3 text-[10px] leading-relaxed tracking-wider text-muted-foreground text-center">
                    Your roll number is your identity. Re-entering will restore your existing recovery progress and score.
                  </p>
                </div>
                <div className="mt-4 border-t border-border/60 pt-3 text-center">
                  <Link
                    to="/admin"
                    className="text-[10px] tracking-wider text-muted-foreground hover:text-primary transition"
                  >
                    Faculty / Event Administrator? Access Staff Control Room →
                  </Link>
                </div>
              </form>
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}

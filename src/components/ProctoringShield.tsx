import { useEffect, useRef, useState, useCallback } from "react";
import { recordTabViolation } from "@/lib/contest.functions";

interface ProctoringShieldProps {
  participantId: string | undefined;
  participantName?: string | undefined;
  rollNo?: string | undefined;
  isLive: boolean;
  initialDisqualified?: boolean | undefined;
}

export function ProctoringShield({
  participantId,
  participantName,
  rollNo,
  isLive,
  initialDisqualified = false,
}: ProctoringShieldProps) {
  const [violationCount, setViolationCount] = useState(0);
  const [lastAwaySeconds, setLastAwaySeconds] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isDisqualified, setIsDisqualified] = useState(initialDisqualified);
  const awayStartTimeRef = useRef<number | null>(null);
  const isHandlingViolationRef = useRef(false);

  useEffect(() => {
    setIsDisqualified(initialDisqualified);
  }, [initialDisqualified]);

  const handleReturnFromAway = useCallback(async () => {
    if (!awayStartTimeRef.current || !participantId || !isLive || isDisqualified) {
      awayStartTimeRef.current = null;
      return;
    }

    const elapsedMs = Date.now() - awayStartTimeRef.current;
    awayStartTimeRef.current = null;

    // Filter out micro-blips (< 800ms) to avoid false positives on browser clicks
    if (elapsedMs < 800) return;

    if (isHandlingViolationRef.current) return;
    isHandlingViolationRef.current = true;

    const awaySec = Math.max(1, Math.round(elapsedMs / 1000));
    setLastAwaySeconds(awaySec);

    try {
      const res = await recordTabViolation({
        data: {
          participantId,
          awaySeconds: awaySec,
        },
      });

      if (res && res.ok) {
        setViolationCount(res.violationCount);
        if (res.disqualified) {
          setIsDisqualified(true);
        } else {
          setShowWarningModal(true);
        }
      }
    } catch (e) {
      console.error("[Proctoring] Failed to record tab violation:", e);
      // Even if offline, increment client side to warn student
      setViolationCount((c) => {
        const next = c + 1;
        if (next >= 3) setIsDisqualified(true);
        else setShowWarningModal(true);
        return next;
      });
    } finally {
      setTimeout(() => {
        isHandlingViolationRef.current = false;
      }, 500);
    }
  }, [participantId, isLive, isDisqualified]);

  useEffect(() => {
    if (!participantId || !isLive || isDisqualified) return;

    // 1. Visibility change listener (tab switch, minimize)
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        awayStartTimeRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        handleReturnFromAway();
      }
    };

    // 2. Window blur & focus listener (clicking another application / split screen)
    const onBlur = () => {
      if (!awayStartTimeRef.current) {
        awayStartTimeRef.current = Date.now();
      }
    };

    const onFocus = () => {
      if (awayStartTimeRef.current) {
        handleReturnFromAway();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [participantId, isLive, isDisqualified, handleReturnFromAway]);

  // If student is suspended/disqualified (3 strikes reached)
  if (isDisqualified) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="w-full max-w-lg rounded-sm border-2 border-status-fail bg-card p-6 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-status-fail/40 pb-4">
            <span className="flex size-10 items-center justify-center rounded-sm bg-status-fail/20 text-xl text-status-fail font-mono font-bold">
              ⛔
            </span>
            <div>
              <h2 className="font-mono text-sm font-bold tracking-wider text-status-fail">
                TERMINAL ACCESS SUSPENDED
              </h2>
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                SECURITY DRILL INCIDENT · SYSTEM FAILURE
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3 font-mono text-xs leading-relaxed text-muted-foreground">
            <p className="text-foreground">
              Your workstation session has been <span className="font-bold text-status-fail">LOCKED</span> due to repeated tab switching outside the recovery console.
            </p>

            <div className="rounded-sm border border-border bg-background/60 p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">OPERATOR:</span>
                <span className="font-bold text-foreground">{participantName || "Participant"}</span>
              </div>
              {rollNo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ROLL NUMBER:</span>
                  <span className="font-bold text-foreground">{rollNo}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">TOTAL STRIKES:</span>
                <span className="font-bold text-status-fail">3 / 3 (LIMIT EXCEEDED)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">INTEGRITY STATUS:</span>
                <span className="font-bold text-status-fail uppercase">DISQUALIFIED / HELD</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Please contact your exam hall invigilator or control room coordinator. Only an administrator can unlock this terminal after physical verification.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Warning Modal for Strikes 1 and 2
  if (showWarningModal) {
    const isFinalWarning = violationCount >= 2;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
        <div
          className={`w-full max-w-md rounded-sm border-2 bg-card p-6 shadow-2xl ${
            isFinalWarning ? "border-status-fail" : "border-status-warn"
          }`}
        >
          <div className="flex items-center gap-3 border-b border-border/80 pb-3.5">
            <span
              className={`flex size-8 items-center justify-center rounded-sm text-lg font-mono font-bold ${
                isFinalWarning
                  ? "bg-status-fail/20 text-status-fail"
                  : "bg-status-warn/20 text-status-warn"
              }`}
            >
              ⚠
            </span>
            <div>
              <h2
                className={`font-mono text-xs font-bold tracking-wider ${
                  isFinalWarning ? "text-status-fail" : "text-status-warn"
                }`}
              >
                {isFinalWarning ? "FINAL SECURITY WARNING · TAB SWITCH" : "SECURITY ALERT · TAB SWITCH DETECTED"}
              </h2>
              <p className="font-mono text-[9px] tracking-widest text-muted-foreground">
                EXAM INTEGRITY SHIELD · VIOLATION RECORDED
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3 font-mono text-xs leading-relaxed text-muted-foreground">
            <p>
              You navigated away from the contest terminal for{" "}
              <strong className="text-foreground">{lastAwaySeconds} seconds</strong>. All tab changes and external focus events are transmitted to the control room.
            </p>

            <div className="rounded border border-border bg-background/60 p-3">
              <div className="flex items-center justify-between text-[11px] mb-2 font-bold">
                <span className="text-muted-foreground">VIOLATION STRIKES:</span>
                <span className={isFinalWarning ? "text-status-fail" : "text-status-warn"}>
                  STRIKE {violationCount} OF 3
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 rounded-sm transition-colors ${
                      step <= violationCount
                        ? step === 3
                          ? "bg-status-fail"
                          : "bg-status-warn"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              {isFinalWarning
                ? "CRITICAL: ONE MORE tab switch or window minimize will permanently lock your terminal and suspend your test."
                : "Notice: 3 strikes will automatically disqualify your session. Stay on this terminal window until submission is complete."}
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className={`w-full rounded border py-2 text-[11px] font-bold tracking-widest transition active:scale-[0.99] ${
                  isFinalWarning
                    ? "border-status-fail bg-status-fail text-status-fail-foreground hover:bg-status-fail/90"
                    : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                I UNDERSTAND — RETURN TO TERMINAL
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

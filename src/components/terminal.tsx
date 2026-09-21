import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type QuestionStatus = "not_attempted" | "attempted" | "solved" | "failed";

const STATUS_META: Record<QuestionStatus, { label: string; chip: string; dot: string }> = {
  not_attempted: {
    label: "NOT ATTEMPTED",
    chip: "border-border text-status-idle",
    dot: "bg-status-idle",
  },
  attempted: {
    label: "ATTEMPTED",
    chip: "border-status-warn/60 text-status-warn",
    dot: "bg-status-warn",
  },
  solved: { label: "SOLVED", chip: "border-status-ok/60 text-status-ok", dot: "bg-status-ok" },
  failed: { label: "FAILED", chip: "border-status-fail/60 text-status-fail", dot: "bg-status-fail" },
};

export function StatusChip({ status, className }: { status: QuestionStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border bg-background/50 px-2 py-1 font-mono text-[9px] font-semibold tracking-[0.14em]",
        meta.chip,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function statusLabel(status: QuestionStatus) {
  return STATUS_META[status].label;
}

export function Led({ tone }: { tone: "ok" | "warn" | "fail" | "idle" }) {
  const map = {
    ok: "bg-status-ok glow-ok",
    warn: "bg-status-warn glow-warn",
    fail: "bg-status-fail glow-fail",
    idle: "bg-status-idle",
  } as const;
  return <span className={cn("inline-block size-1.5 rounded-full animate-blip", map[tone])} />;
}

export function Panel({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("panel-frame rounded-sm", className)}>
      <header className="flex min-h-10 items-center justify-between gap-3 border-b border-border/70 bg-background/25 px-4 py-2.5">
        <h2 className="scanline-title text-[10px] text-muted-foreground">{title}</h2>
        {right}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? "Switch to Dark mode (Night Ops)" : "Switch to Daylight mode (Lab Daylight)"}
      aria-label="Toggle daylight and dark theme"
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-sm border border-border/80 bg-panel/75 px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.14em] text-muted-foreground transition-all hover:border-primary/60 hover:bg-panel hover:text-foreground active:scale-95",
        className
      )}
    >
      <span className="text-[11px] leading-none transition-transform group-hover:scale-110">
        {isLight ? "☀" : "🌙"}
      </span>
      <span className="hidden md:inline text-[9px] uppercase tracking-wider">
        {isLight ? "DAYLIGHT" : "DARK"}
      </span>
      <span
        className={cn(
          "size-1.5 rounded-full transition-colors",
          isLight ? "bg-accent" : "bg-primary"
        )}
      />
    </button>
  );
}

export function TerminalHeader({
  right,
  variant = "participant",
  onSignOut,
}: {
  right?: ReactNode;
  variant?: "participant" | "admin";
  onSignOut?: () => void;
}) {
  const isAdmin = variant === "admin";
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to={isAdmin ? "/admin" : "/"} className="group flex items-center gap-3 text-sm">
          <Led tone={isAdmin ? "warn" : "fail"} />
          <span className="scanline-title text-[11px] text-foreground transition-colors group-hover:text-primary">
            {isAdmin ? "Control Room" : "System Failure"}
          </span>
          <span className="hidden border-l border-border pl-3 font-mono text-[9px] tracking-[0.16em] text-muted-foreground sm:inline">
            {isAdmin ? "ADMIN@SF-CONTEST · OPERATIONS" : "ROOT@SF-CONTEST · CHALLENGES"}
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground sm:gap-2">
          {isAdmin ? (
            <>
              <Link to="/" className="rounded-sm px-2.5 py-1.5 transition-colors hover:bg-primary/10 hover:text-primary">
                PUBLIC SITE
              </Link>
              {onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="rounded-sm px-2.5 py-1.5 tracking-[0.14em] transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  SIGN OUT
                </button>
              ) : null}
            </>
          ) : (
            <>
              <Link to="/contest" className="rounded-sm px-2.5 py-1.5 transition-colors hover:bg-primary/10 hover:text-primary">
                CONSOLE
              </Link>
              <Link to="/leaderboard" className="rounded-sm px-2.5 py-1.5 transition-colors hover:bg-primary/10 hover:text-primary">
                LEADERBOARD
              </Link>
              <Link to="/admin" className="rounded-sm px-2.5 py-1.5 transition-colors hover:bg-primary/10 hover:text-primary">
                ADMIN
              </Link>
            </>
          )}
          <div className="mx-1 h-3.5 w-px bg-border/80" />
          <ThemeToggle />
          {right}
        </nav>
      </div>
    </header>
  );
}



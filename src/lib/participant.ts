import { useCallback, useEffect, useState } from "react";

const KEY = "sysfail.participant";

export type StoredParticipant = { id: string; code: string };

export function readParticipant(): StoredParticipant | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredParticipant;
    return parsed.id && parsed.code ? parsed : null;
  } catch {
    return null;
  }
}

export function writeParticipant(value: StoredParticipant) {
  window.localStorage.setItem(KEY, JSON.stringify(value));
}

export function clearParticipant() {
  window.localStorage.removeItem(KEY);
}

export function useParticipant() {
  const [participant, setParticipant] = useState<StoredParticipant | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setParticipant(readParticipant());
    setReady(true);
  }, []);

  const signOut = useCallback(() => {
    clearParticipant();
    setParticipant(null);
  }, []);

  return { participant, ready, signOut };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

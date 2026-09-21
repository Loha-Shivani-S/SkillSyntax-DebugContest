// Sandboxed C compilation + execution.
// Supports Judge0 API (Section 1 & 24) with isolated remote sandbox fallback.
// User code never executes inside the host process runtime.

export type JudgeResult = {
  compileError: string | null;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
};

const WANDBOX_URL = "https://wandbox.org/api/compile.json";
const COMPILER = "gcc-head-c";

/**
 * Execute C code against Judge0 API
 */
async function executeJudge0(
  apiUrl: string,
  apiKey: string | undefined,
  code: string,
  stdin: string
): Promise<JudgeResult | null> {
  try {
    const cleanUrl = apiUrl.replace(/\/+$/, "");
    const endpoint = `${cleanUrl}/submissions?base64_encoded=false&wait=true`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      if (cleanUrl.includes("rapidapi.com")) {
        headers["X-RapidAPI-Key"] = apiKey;
        headers["X-RapidAPI-Host"] = new URL(cleanUrl).hostname;
      } else {
        headers["X-Auth-Token"] = apiKey;
      }
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source_code: code,
        language_id: 50, // C (GCC 9.2.0)
        stdin,
        cpu_time_limit: 2.0, // 2s CPU limit
        memory_limit: 128000, // 128MB memory limit
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const compileOutput = (data.compile_output ?? "").trim();
    const stdout = (data.stdout ?? "").trim();
    const stderr = (data.stderr ?? "").trim();
    const statusId = data.status?.id;

    // Status 3 = Accepted, 4 = Wrong Answer, 5 = Time Limit Exceeded, 6 = Compilation Error, 7-12 = Runtime Error
    const compileError = statusId === 6 || compileOutput.length > 0 ? compileOutput.slice(0, 4000) : null;
    const timedOut = statusId === 5;

    return {
      compileError,
      stdout,
      stderr: stderr.slice(0, 2000),
      exitCode: statusId === 3 || statusId === 4 ? 0 : 1,
      timedOut,
    };
  } catch (err) {
    console.warn("[Judge0] Call failed, falling back to Wandbox:", err);
    return null;
  }
}

/**
 * Execute C code against Wandbox GCC isolated remote compiler
 */
async function executeWandbox(code: string, stdin: string): Promise<JudgeResult> {
  const response = await fetch(WANDBOX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compiler: COMPILER,
      code,
      stdin,
      "compiler-option-raw": "-std=c11\n-Wall\n-lm",
    }),
  });

  if (!response.ok) {
    throw new Error(`compiler service returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    signal?: string;
    compiler_error?: string;
    compiler_output?: string;
    program_output?: string;
    program_error?: string;
  };

  const compilerError = (payload.compiler_error ?? "").trim();
  const exitCode = Number.parseInt(payload.status ?? "-1", 10);
  const programOutput = payload.program_output ?? "";
  const programError = (payload.program_error ?? "").trim();

  // Warnings also land in compiler_error, so only treat real errors as build failures.
  const buildFailed = /(^|\n).*\b(error|fatal error):/i.test(compilerError);

  return {
    compileError: buildFailed ? compilerError.slice(0, 4000) : null,
    stdout: programOutput,
    stderr: programError.slice(0, 2000),
    exitCode: Number.isNaN(exitCode) ? -1 : exitCode,
    timedOut: (payload.signal ?? "").includes("Killed") || (payload.signal ?? "") === "SIGKILL",
  };
}

export async function executeC(code: string, stdin: string): Promise<JudgeResult> {
  const judge0Url = process.env.JUDGE0_API_URL;
  const judge0Key = process.env.JUDGE0_API_KEY;

  if (judge0Url) {
    const result = await executeJudge0(judge0Url, judge0Key, code, stdin);
    if (result) return result;
  }

  return executeWandbox(code, stdin);
}

export function normalizeOutput(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

# 🐞 SYSTEM FAILURE
### *Hardware × Software Debugging Challenge*

A production-ready technical mission and debugging contest platform designed for 2nd-year Electronics and Instrumentation Engineering (EIE) students.

Participants are provided with broken C programs embedded in realistic industrial instrumentation scenarios (sensors, signal conditioning, ADC conversion, relays, PWM motor controllers, and master plant supervisory logic). They must observe symptoms, locate bugs, fix the code, and restore malfunctioning subsystems.

---

## ⚡ Key Features

- **90-Minute Server-Controlled Contest**: Real-time server-enforced countdown timer with auto-lock on expiry.
- **12 EIE-Themed C Debugging Challenges**: 100 points total across calibrated difficulties (Easy 5pts, Medium 8pts, Hard 10pts, Final Boss 20pts).
- **Monaco Code Editor**: Professional in-browser code editor with C syntax highlighting, line numbers, bracket matching, and keyboard shortcuts.
- **Isolated Sandboxed Execution**: Safe remote C compilation and execution (supports Judge0 API, Wandbox, and Piston) with compile error formatting and CPU/execution limits.
- **Test Case Evaluation & Partial Scoring**: Instant sample test verification ("Run Code") and hidden test validation with weighted partial scores ("Submit Code").
- **Live Leaderboard**: Real-time ranking with score and earliest tie-breaker resolution, plus admin freeze and publish controls.
- **Full Admin Control Room**: Contest state machine (Draft, Ready, Live, Ended, Published), participant management (suspend, reset, delete), question inspection, submission audit logs, and CSV score export.
- **Industrial Terminal Aesthetic**: Dark mode, scanlines, hardware status LEDs, responsive layout.

---

## 🛠 Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Monaco Editor (`@monaco-editor/react`), TanStack Router
- **Backend**: Node.js, TanStack Start server functions
- **Database**: PostgreSQL / Supabase with resilient local fallback
- **Execution**: Sandboxed remote compiler API (Judge0 / isolated compiler service)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (`.env`):
   ```env
   # Database (PostgreSQL / Supabase)
   DATABASE_URL="postgresql://user:password@localhost:5432/sysfailure"

   # Optional Remote Judge0 Sandbox API
   JUDGE0_API_URL="https://judge0-ce.p.rapidapi.com"
   JUDGE0_API_KEY=""

   # Admin Passcode (Default: RECOVER-2026)
   ADMIN_PASSCODE="RECOVER-2026"
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

---

## 🔑 Admin Access

Navigate to `/admin` and authenticate with the default passcode:
```text
RECOVER-2026
```
From the admin panel, you can transition contest states (`DRAFT` → `READY` → `LIVE` → `ENDED`), freeze/publish leaderboards, inspect live code submissions, manage participants, and export final scores to CSV.

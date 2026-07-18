# DevLoop AI Demo Video Guide

Target length: 2 minutes 30 seconds. Record at 1080p with the browser zoom near 100%. Use Demo mode unless the deployed Gemini run has already been tested immediately before recording.

## Narration and screen flow

### 0:00–0:20 — Problem

**Screen:** DevLoop AI hero, no interaction yet.

**Say:**

> AI coding tools often stop at the first answer. That answer may look complete while missing validation, accessibility, security, or safe error handling. DevLoop AI treats the first answer as the beginning of an engineering process.

### 0:20–0:38 — Product promise

**Screen:** Slowly point to the workflow rail and provider badge.

**Say:**

> DevLoop turns one requirement into a controlled loop: plan, generate, review, improve, and repeat. It stops when the overall quality score reaches 85, or after three iterations, so the process stays measurable and bounded.

### 0:38–0:55 — Start the run

**Screen:** Click **Try sample**. Pause so the requirement is readable, then click **Run engineering loop**.

**Say:**

> I’ll ask it to create an Angular login component with validation, accessibility, a loading state, and error handling.

### 0:55–1:20 — Live orchestration

**Screen:** Let the workflow animate without moving the pointer. Follow Planning, Generating, Reviewing, and Improving.

**Say:**

> The backend orchestrates separate planning, generation, review, and improvement calls. The browser receives each stage as a live server event. The model cannot extend the loop indefinitely—the application owns the stopping rule.

### 1:20–1:48 — Evidence of improvement

**Screen:** Show the 58 → 76 → 91 progression. Click Iteration 1, then 2, then 3.

**Say:**

> Version one scores 58 and lacks labels, validation, and a real authentication boundary. Version two adds reactive validation, accessible labels, and loading protection. Version three reaches 91 after adding typed controls, service isolation, safe errors, and stronger accessibility.

### 1:48–2:08 — Findings and changes

**Screen:** Pause over review findings and applied changes, then scroll the final code.

**Say:**

> Every version keeps its code, review findings, applied changes, and six category scores. This makes the improvement trace inspectable instead of hiding it behind a single final response.

### 2:08–2:22 — Architecture and trust

**Screen:** Keep the final code and score visible.

**Say:**

> DevLoop uses Angular, Express, TypeScript, Gemini, structured JSON validation, and server-sent events. The API key stays on the server, generated code is never executed, and Demo mode provides a reliable fallback for judging.

### 2:22–2:30 — Close

**Screen:** Return near the title or keep the 91 score visible.

**Say:**

> DevLoop AI: because the first answer is just the beginning.

## Recording checklist

- Close personal tabs, notifications, terminals containing keys, and password managers.
- Use the deployed URL in a clean browser window.
- Verify the badge says **Demo mode** for the deterministic recording.
- Run the sample once before recording; then click **New run** so the recording starts clean.
- Keep the pointer still while workflow stages animate.
- Do not claim that generated code was executed or security-audited.
- Record one clean take and one backup take.
- Trim dead time only; preserve the visible score progression.
- Export MP4 at 1080p and play the exported file from beginning to end.

## Fallback plan

If Gemini is slow, rate-limited, or returns malformed structured output, set `LLM_PROVIDER=demo`, redeploy, verify `/api/health`, and record the deterministic 58 → 76 → 91 run. Say “Demo mode” clearly; its purpose is presentation reliability, not pretending to be a live provider response.

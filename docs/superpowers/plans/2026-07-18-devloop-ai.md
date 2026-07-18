# DevLoop AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a demo-ready Angular and Express application that visibly plans, generates, reviews, and improves code for at most three iterations.

**Architecture:** An Angular standalone client consumes an Express endpoint that returns newline-delimited server-sent events. A provider-independent orchestrator runs the engineering loop; deterministic demo and Gemini providers implement the same typed interface. The latest completed run is kept in browser storage, with no database or user accounts.

**Tech Stack:** Node.js 22, npm workspaces, Angular 20, TypeScript, Express, Zod, Vitest, Google GenAI SDK, CSS, Server-Sent Events.

## Global Constraints

- Submission deadline: July 19, 2026 at 23:59 IST.
- Stop when overall quality reaches 85 or after exactly three reviewed iterations, whichever comes first.
- Demo mode is the default and must be visibly labelled.
- Gemini credentials stay in the API environment and never enter the Angular bundle.
- Generated code is displayed but never executed.
- Persist only the latest completed run in browser `localStorage`.
- Do not add authentication, databases, repository ingestion, autonomous tools, or CI/CD execution.

---

### Task 1: Workspace and Shared Domain Contract

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/src/domain.ts`
- Test: `api/src/domain.test.ts`
- Create: `web/` through Angular CLI, then keep its generated test/build configuration.

**Interfaces:**
- Produces: `QualityScores`, `PlanResult`, `GenerationResult`, `ReviewResult`, `Iteration`, `RunResult`, `RunEvent`, and Zod schemas used by every later task.

- [ ] **Step 1: Scaffold the npm workspace and Angular app**

Run:

```bash
npm init -y
npx @angular/cli@20 new web --standalone --style=css --routing=false --skip-git --package-manager=npm
mkdir -p api/src
```

Set the root scripts to invoke both workspaces and add `concurrently` for local development. Configure the API for ESM, `tsx` development, `tsc` builds, and Vitest tests.

- [ ] **Step 2: Write the failing domain-schema tests**

```typescript
import { describe, expect, it } from 'vitest';
import { qualityScoresSchema, requirementSchema } from './domain.js';

describe('domain validation', () => {
  it('rejects an incomplete quality score set', () => {
    expect(() => qualityScoresSchema.parse({ overall: 80 })).toThrow();
  });

  it('accepts a requirement between 10 and 2000 characters', () => {
    expect(requirementSchema.parse('Build an accessible Angular login form')).toBeTruthy();
  });

  it('rejects a requirement shorter than 10 characters', () => {
    expect(() => requirementSchema.parse('login')).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests and confirm the missing-module failure**

Run: `npm test --workspace api -- src/domain.test.ts`

Expected: FAIL because `domain.ts` does not exist.

- [ ] **Step 4: Implement the shared contract and schemas**

```typescript
import { z } from 'zod';

export const requirementSchema = z.string().trim().min(10).max(2000);
export const qualityScoresSchema = z.object({
  correctness: z.number().min(0).max(100),
  maintainability: z.number().min(0).max(100),
  security: z.number().min(0).max(100),
  accessibility: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
  requirementCoverage: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});

export type QualityScores = z.infer<typeof qualityScoresSchema>;
export interface PlanResult { summary: string; steps: string[]; }
export interface GenerationResult { code: string; language: string; changes: string[]; }
export interface ReviewResult { scores: QualityScores; findings: string[]; }
export interface Iteration extends GenerationResult, ReviewResult { number: number; }
export interface RunResult {
  requirement: string;
  provider: 'demo' | 'gemini';
  plan: PlanResult;
  iterations: Iteration[];
  completedAt: string;
}
export type RunStage = 'planning' | 'generating' | 'reviewing' | 'improving' | 'complete';
export type RunEvent =
  | { type: 'stage'; stage: RunStage; message: string }
  | { type: 'plan'; plan: PlanResult }
  | { type: 'iteration'; iteration: Iteration }
  | { type: 'complete'; result: RunResult }
  | { type: 'error'; message: string };
```

- [ ] **Step 5: Run the domain tests and commit**

Run: `npm test --workspace api -- src/domain.test.ts`

Expected: 3 passing tests.

Commit: `git commit -am "chore: scaffold DevLoop workspace and domain contract"`

---

### Task 2: Test-Driven Loop Orchestrator and Demo Provider

**Files:**
- Create: `api/src/providers/provider.ts`
- Create: `api/src/providers/demo-provider.ts`
- Create: `api/src/loop.ts`
- Test: `api/src/loop.test.ts`
- Test: `api/src/providers/demo-provider.test.ts`

**Interfaces:**
- Consumes: domain types from Task 1.
- Produces: `LoopProvider`, `runEngineeringLoop(input)`, and `DemoProvider`.

- [ ] **Step 1: Define the provider interface**

```typescript
import type { GenerationResult, PlanResult, ReviewResult } from '../domain.js';

export interface LoopProvider {
  readonly name: 'demo' | 'gemini';
  plan(requirement: string): Promise<PlanResult>;
  generate(requirement: string, plan: PlanResult): Promise<GenerationResult>;
  review(requirement: string, plan: PlanResult, code: string, iteration: number): Promise<ReviewResult>;
  improve(requirement: string, plan: PlanResult, code: string, review: ReviewResult, nextIteration: number): Promise<GenerationResult>;
}
```

- [ ] **Step 2: Write failing early-stop and maximum-iteration tests**

Use a small in-test provider whose `review` returns supplied scores. Assert that scores `[91]` produce one iteration, scores `[55, 72, 83]` produce three iterations, and stage events end with `complete`. Also assert that `improve` is called zero and two times respectively.

- [ ] **Step 3: Run the orchestrator tests and confirm failure**

Run: `npm test --workspace api -- src/loop.test.ts`

Expected: FAIL because `runEngineeringLoop` is missing.

- [ ] **Step 4: Implement the loop**

```typescript
export async function runEngineeringLoop(input: {
  requirement: string;
  provider: LoopProvider;
  emit: (event: RunEvent) => void;
}): Promise<RunResult> {
  const { requirement, provider, emit } = input;
  emit({ type: 'stage', stage: 'planning', message: 'Turning your requirement into an engineering plan' });
  const plan = await provider.plan(requirement);
  emit({ type: 'plan', plan });
  emit({ type: 'stage', stage: 'generating', message: 'Building the first implementation' });
  let generation = await provider.generate(requirement, plan);
  const iterations: Iteration[] = [];

  for (let number = 1; number <= 3; number += 1) {
    emit({ type: 'stage', stage: 'reviewing', message: `Reviewing iteration ${number}` });
    const review = await provider.review(requirement, plan, generation.code, number);
    const iteration = { number, ...generation, ...review };
    iterations.push(iteration);
    emit({ type: 'iteration', iteration });
    if (review.scores.overall >= 85 || number === 3) break;
    emit({ type: 'stage', stage: 'improving', message: `Applying review feedback to iteration ${number + 1}` });
    generation = await provider.improve(requirement, plan, generation.code, review, number + 1);
  }

  emit({ type: 'stage', stage: 'complete', message: 'Engineering loop complete' });
  const result = { requirement, provider: provider.name, plan, iterations, completedAt: new Date().toISOString() };
  emit({ type: 'complete', result });
  return result;
}
```

- [ ] **Step 5: Write a failing deterministic demo-provider test**

Assert that two independent runs return identical plans and score progression `[58, 76, 91]` with meaningful code, findings, and changes in each iteration.

- [ ] **Step 6: Implement the deterministic provider**

Return a fixed Angular login plan, three progressively enhanced Angular component code strings, matching review findings, and complete score objects with overall scores 58, 76, and 91. Select the review result by iteration number, not mutable global state.

- [ ] **Step 7: Run tests and commit**

Run: `npm test --workspace api`

Expected: all orchestrator and demo-provider tests pass.

Commit: `git commit -am "feat: add iterative engineering loop and demo provider"`

---

### Task 3: Gemini Provider and Streamed HTTP API

**Files:**
- Create: `api/src/providers/gemini-provider.ts`
- Test: `api/src/providers/gemini-provider.test.ts`
- Create: `api/src/config.ts`
- Create: `api/src/app.ts`
- Create: `api/src/server.ts`
- Test: `api/src/app.test.ts`
- Create: `api/.env.example`

**Interfaces:**
- Consumes: `LoopProvider`, domain schemas, `runEngineeringLoop`.
- Produces: `GeminiProvider`, `createApp(config)`, `/api/health`, and `/api/runs`.

- [ ] **Step 1: Write failing Gemini parsing tests**

Inject a fake `generateContent(prompt)` function. Verify fenced JSON is accepted, incomplete score JSON is rejected, one malformed response is retried, and two malformed responses throw `The model returned an invalid structured response.`

- [ ] **Step 2: Implement the Gemini provider**

Use `@google/genai` on the server. Each operation sends the requirement, plan, current code, review, and a literal JSON response shape appropriate to that operation. Strip an optional Markdown fence, parse JSON, validate with Zod, and retry exactly once after a parse or schema failure. Set temperature to `0.2` and default model to `gemini-2.5-flash` through `GEMINI_MODEL`.

- [ ] **Step 3: Write failing API tests**

Using Supertest, verify:

```typescript
expect((await request(app).get('/api/health')).body).toEqual({ status: 'ok', provider: 'demo' });
expect((await request(app).post('/api/runs').send({ requirement: 'short' })).status).toBe(400);
const response = await request(app).post('/api/runs').send({
  requirement: 'Create an Angular login component with validation and accessibility',
});
expect(response.status).toBe(200);
expect(response.headers['content-type']).toContain('text/event-stream');
expect(response.text).toContain('event: complete');
```

- [ ] **Step 4: Implement the API and SSE serialization**

`POST /api/runs` validates `{ requirement }`, writes `event: <type>\ndata: <json>\n\n` for every `RunEvent`, and ends after `complete` or `error`. `GET /api/health` exposes only status and provider name. Enable JSON parsing, Helmet, compression, and CORS limited by `CLIENT_ORIGIN`. Never include keys or raw Gemini responses in error output.

- [ ] **Step 5: Add environment template**

```dotenv
LLM_PROVIDER=demo
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
CLIENT_ORIGIN=http://localhost:4200
```

- [ ] **Step 6: Run API tests and build, then commit**

Run:

```bash
npm test --workspace api
npm run build --workspace api
```

Expected: all tests pass and TypeScript exits with code 0.

Commit: `git commit -am "feat: add Gemini provider and streamed API"`

---

### Task 4: Angular Run Store and Event Consumption

**Files:**
- Create: `web/src/app/models.ts`
- Create: `web/src/app/run-api.service.ts`
- Test: `web/src/app/run-api.service.spec.ts`
- Create: `web/src/app/run.store.ts`
- Test: `web/src/app/run.store.spec.ts`
- Modify: `web/src/environments/environment.ts`

**Interfaces:**
- Consumes: `/api/runs` SSE event contract.
- Produces: `RunApiService.streamRun(requirement)`, `RunStore.start(requirement)`, and readonly signals for stage, plan, iterations, result, loading, and error.

- [ ] **Step 1: Copy the API domain types into a browser-safe model module**

Keep property names identical to Task 1. Do not import Zod or backend source into the browser build.

- [ ] **Step 2: Write failing stream-parser tests**

Mock `fetch` with a `ReadableStream` split across arbitrary chunks. Assert that two SSE records split in the middle of `data:` are reconstructed and emitted in order. Assert an HTTP 500 produces `Unable to start the engineering loop.`

- [ ] **Step 3: Implement the API service**

Use `fetch` because Angular `HttpClient` does not expose incremental response bodies consistently. Decode chunks with `TextDecoder`, retain incomplete text between reads, split records on blank lines, parse their `event:` and `data:` fields, and expose an `Observable<RunEvent>` whose teardown aborts the fetch.

- [ ] **Step 4: Write failing store tests**

Verify initial idle state, event-driven stage updates, appending three iterations, preserving received iterations after an error, saving only a completed result to `localStorage`, and restoring a valid saved result during construction.

- [ ] **Step 5: Implement the signal store**

Use Angular signals in an injectable service. Starting a run clears the previous active state but not browser storage until completion. Handle each event through a single `applyEvent` method. Expose a `reset()` method and a computed latest iteration.

- [ ] **Step 6: Run tests and commit**

Run: `npm test --workspace web -- --watch=false`

Expected: all Angular service/store tests pass.

Commit: `git commit -am "feat: stream loop progress into Angular state"`

---

### Task 5: Demo-Ready Angular Workspace

**Files:**
- Modify: `web/src/app/app.ts`
- Modify: `web/src/app/app.html`
- Modify: `web/src/app/app.css`
- Modify: `web/src/styles.css`
- Test: `web/src/app/app.spec.ts`

**Interfaces:**
- Consumes: `RunStore` readonly state and actions.
- Produces: the complete single-page judging experience.

- [ ] **Step 1: Write failing component tests**

Verify that the page renders “DevLoop AI,” shows the provider badge, disables Run for empty input, fills the exact sample prompt from “Try sample,” renders workflow stage labels, displays iteration tabs after store events, shows an overall score, switches selected iteration, and surfaces a terminal error message.

- [ ] **Step 2: Run the tests and confirm UI assertions fail**

Run: `npm test --workspace web -- --watch=false`

Expected: FAIL because the generated Angular starter does not contain the product UI.

- [ ] **Step 3: Implement the standalone component**

Use reactive form control state, inject `RunStore`, define the sample requirement, track selected iteration number, submit through the store, and copy the selected code through `navigator.clipboard`. Keep all presentation derived from store state; do not duplicate run data in component fields.

- [ ] **Step 4: Build the semantic template**

Create one page with: compact navigation/logo and provider badge; hero copy; requirement composer; five-stage ordered workflow; score progression; six score cards; iteration tabs; plan list; review findings; applied changes; code panel; error region with `role="alert"`; and reset/copy controls. Use buttons for all interactive elements and visible keyboard focus.

- [ ] **Step 5: Apply the responsive visual system**

Use CSS custom properties for an ink background, elevated navy surfaces, cyan primary, violet accent, success green, warning amber, and muted text. Add a subtle grid/glow background, a two-column results layout above 1024px, a single column below it, horizontal scrolling for code, reduced-motion support, and no external image dependency.

- [ ] **Step 6: Run tests, accessibility-oriented template checks, and build**

Run:

```bash
npm test --workspace web -- --watch=false
npm run build --workspace web
```

Expected: all Angular tests pass and production build exits with code 0.

Commit: `git commit -am "feat: build DevLoop AI demo workspace"`

---

### Task 6: Deployment, Documentation, and End-to-End Verification

**Files:**
- Create: `README.md`
- Create: `render.yaml`
- Create: `web/vercel.json`
- Create: `docs/demo-video.md`
- Create: `docs/submission-checklist.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: completed frontend and API.
- Produces: reproducible local setup, deployable services, and submission-ready instructions.

- [ ] **Step 1: Add deployment configuration**

Configure Render to build and start the API with the workspace scripts, health-check `/api/health`, and declare non-secret environment names. Configure Vercel for the Angular output directory and SPA rewrites. Document setting the deployed API base URL before the frontend build.

- [ ] **Step 2: Write the README**

Include the problem, loop-engineering differentiator, architecture, feature list, exact local setup, Demo/Gemini environment configuration, scripts, test/build commands, deployment steps, security statement, project scope, known hackathon constraints, and a two-minute judging walkthrough. Explicitly state that scores are LLM evaluations rather than executed-code guarantees.

- [ ] **Step 3: Write the demo-video guide**

Create a 2:30 script with timestamps: 0:00 problem; 0:20 product promise; 0:35 sample requirement; 0:50 live stages; 1:20 iteration progression 58→76→91; 1:45 findings and changes; 2:05 final code and architecture; 2:25 closing tagline. Include an exact screen-recording checklist and fallback instructions using Demo mode.

- [ ] **Step 4: Run complete automated verification**

Run:

```bash
npm test
npm run build
```

Expected: both workspace test suites pass and both production builds exit 0.

- [ ] **Step 5: Verify a real streamed demo run**

Start the API in Demo mode and request the sample requirement. Confirm the event order contains planning, generating, reviewing, improving, reviewing, improving, reviewing, complete; confirm exactly three iteration events with scores 58, 76, and 91; and confirm `/api/health` returns provider `demo`.

- [ ] **Step 6: Inspect the browser experience**

Start both services, load the Angular page at desktop and narrow viewport widths, run the sample flow, inspect every iteration, copy final code, refresh to verify restoration, and verify error presentation with the API stopped.

- [ ] **Step 7: Review repository scope and commit**

Run:

```bash
git status --short
git diff --check
git log --oneline --decorate -8
```

Confirm no `.env`, key, build output, or unrelated file is tracked.

Commit: `git commit -am "docs: prepare DevLoop AI submission and deployment"`

# OpenAI Provider and Live Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run DevLoop through OpenAI with structured output and show the configured live provider before the first completed run.

**Architecture:** Add an `OpenAIProvider` behind the existing `LoopProvider` interface and select it through environment configuration. Reuse `/api/health` as the public provider-status source, expose that status through `RunApiService` and `RunStore`, and render the badge from current backend status rather than a completed result. Keep provider keys server-only and preserve the current SSE loop contract.

**Tech Stack:** Node.js 22, TypeScript, Express, Angular, Zod 4, Vitest, Jasmine/Karma, OpenAI Chat Completions REST API with Structured Outputs.

## Global Constraints

- Use `gpt-5.4-mini` as the default OpenAI model.
- Keep `OPENAI_API_KEY` server-only and environment-driven.
- Preserve the maximum of three engineering iterations.
- Do not retry HTTP 400 responses as malformed model JSON.
- Return safe, actionable messages for rate limits and provider failures.
- Keep Groq, Gemini, and Demo providers available.

---

### Task 1: OpenAI provider

**Files:**
- Create: `api/src/providers/openai-provider.ts`
- Create: `api/src/providers/openai-provider.test.ts`
- Modify: `api/src/providers/provider.ts`

**Interfaces:**
- Consumes: `LoopProvider`, existing domain Zod schemas.
- Produces: `OpenAIProvider` implementing `plan`, `generate`, `review`, and `improve`.

- [ ] **Step 1: Write failing provider tests**

Add tests proving structured plan parsing, one retry for schema-invalid successful responses, and immediate propagation of HTTP provider errors.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test --workspace api -- openai-provider.test.ts`
Expected: FAIL because `OpenAIProvider` does not exist.

- [ ] **Step 3: Implement the provider**

Call `https://api.openai.com/v1/chat/completions` with `gpt-5.4-mini`, server-side bearer authentication, strict JSON Schema response formatting, and a 120-second timeout. Parse the returned content through the existing Zod schemas. Retry only parsing/schema failures once; preserve HTTP errors.

- [ ] **Step 4: Verify provider tests pass**

Run: `npm test --workspace api -- openai-provider.test.ts`
Expected: PASS.

### Task 2: Configuration and server selection

**Files:**
- Modify: `api/src/config.test.ts`
- Modify: `api/src/config.ts`
- Modify: `api/src/server.ts`
- Modify: `api/src/app.test.ts`
- Modify: `api/src/app.ts`
- Modify: `api/.env.example`
- Modify: `render.yaml`

**Interfaces:**
- Consumes: `OpenAIProvider`.
- Produces: `LLM_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` configuration.

- [ ] **Step 1: Write failing configuration and error-message tests**

Test that OpenAI is selected with a required key and default model, and that safe rate-limit/provider messages reach the SSE client.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test --workspace api -- config.test.ts app.test.ts`
Expected: FAIL because OpenAI configuration and provider messages are unsupported.

- [ ] **Step 3: Implement configuration and selection**

Extend provider unions with `openai`, instantiate `OpenAIProvider` in `server.ts`, preserve known safe provider errors in `app.ts`, and document Render/local variables without adding secrets.

- [ ] **Step 4: Verify API tests pass**

Run: `npm test --workspace api`
Expected: PASS.

### Task 3: Accurate provider badge

**Files:**
- Modify: `web/src/app/models.ts`
- Modify: `web/src/app/run-api.service.spec.ts`
- Modify: `web/src/app/run-api.service.ts`
- Modify: `web/src/app/run.store.spec.ts`
- Modify: `web/src/app/run.store.ts`
- Modify: `web/src/app/app.spec.ts`
- Modify: `web/src/app/app.ts`

**Interfaces:**
- Consumes: `GET /api/health -> {status, provider}`.
- Produces: `RunStore.provider` signal and provider badge labels including `OpenAI live`.

- [ ] **Step 1: Write failing service/store/component tests**

Test provider-status retrieval, store initialization, and `OpenAI live` rendering before any run completes.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test --workspace web -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL because provider status is derived only from completed results.

- [ ] **Step 3: Implement provider status**

Load `/api/health` on store construction, keep `demo` as a safe fallback, update status after a completed run, and render the badge from the provider signal.

- [ ] **Step 4: Verify frontend tests pass**

Run: `npm test --workspace web -- --watch=false --browsers=ChromeHeadless`
Expected: PASS.

### Task 4: Documentation and complete verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: verified environment names and deployment behavior.
- Produces: setup and Render deployment instructions.

- [ ] **Step 1: Update documentation**

Document OpenAI as the recommended live provider, explicitly separate ChatGPT subscriptions from API billing, and retain Groq/Gemini alternatives.

- [ ] **Step 2: Run all verification**

Run: `npm test && npm run build && git diff --check`
Expected: all API/frontend tests pass, both production builds succeed, and whitespace checks are clean.

- [ ] **Step 3: Commit and push**

Run: `git add api web README.md render.yaml docs/superpowers/plans/2026-07-19-openai-provider-live-status.md && git commit -m "feat: add OpenAI live provider" && git push origin master`
Expected: GitHub contains the verified OpenAI integration; Render can deploy after its environment variables are saved.

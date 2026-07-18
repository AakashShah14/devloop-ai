# DevLoop AI MVP Design

## Objective

Build a demo-ready hackathon application that demonstrates loop engineering by planning, generating, reviewing, and improving AI-generated code. The submission deadline is July 19, 2026 at 23:59 IST, so the MVP prioritizes a clear judging story and reliable presentation over production breadth.

## Product Story

Most AI coding tools return their first answer even when it misses requirements or engineering best practices. DevLoop AI makes improvement visible: it generates an initial solution, evaluates it against explicit quality dimensions, applies the review, and repeats until the solution reaches an overall score of 85 or completes three iterations.

The primary demo prompt is: “Create an Angular login component with validation, accessibility, loading state, and error handling.”

## Scope

### Included

- Requirement input with a ready-to-run sample prompt.
- Live workflow stages: Planning, Generating, Reviewing, Improving, and Complete.
- A plan followed by at most three generate/review/improve iterations.
- Early completion when the overall quality score reaches 85.
- Iteration history containing code, review findings, changes, and scores.
- Quality scores for correctness, maintainability, security, accessibility, performance, and requirement coverage.
- Final code with copy action and a start-new-run action.
- Google Gemini integration configured through server-side environment variables.
- A deterministic demo provider that needs no API key and is visibly labelled “Demo mode.”
- Browser-session persistence for the latest completed run.
- Local verification, deployment configuration, README, and demo-video instructions.

### Excluded

- Executing generated code.
- GitHub repository ingestion or issue creation.
- Authentication, accounts, databases, and shared run history.
- Arbitrary agent tool execution, CI/CD automation, or deployments initiated by the AI.
- Multi-language optimization. The prompts accept general development requests, but the polished demo targets Angular/TypeScript.

## Architecture

The project is a small npm workspace with an Angular standalone frontend and an Express/TypeScript backend. The browser sends a requirement to the API. The backend selects either the Gemini provider or deterministic demo provider, orchestrates the loop, validates structured provider results, and emits progress events using server-sent events. The frontend renders those events as a live workflow and assembles iteration history without requiring a database.

```text
Angular frontend
  -> POST /api/runs (SSE response)
  -> plan(requirement)
  -> generate(requirement, plan)
  -> review(requirement, plan, code)
  -> improve while score < 85 and iteration < 3
  -> final result
```

The LLM API key never reaches the browser. Configuration uses `LLM_PROVIDER=demo|gemini`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `PORT`, and `CLIENT_ORIGIN`. Demo mode is the default so a fresh checkout runs safely.

## Backend Components

- **HTTP application:** Health endpoint, run request validation, SSE headers, event serialization, and safe error responses.
- **Loop orchestrator:** Owns stage ordering, early stopping at 85, and the three-iteration maximum. It depends only on the provider interface and an event callback.
- **Provider interface:** Defines typed plan, generation, review, and improvement operations.
- **Demo provider:** Returns deterministic, progressively better Angular output and scores for an uninterrupted presentation.
- **Gemini provider:** Calls Gemini with structured prompts, extracts JSON, validates it, and retries malformed model output once.
- **Schemas and domain types:** Validate incoming requirements, scores from 0–100, required score categories, iteration records, and stream event payloads.

## Frontend Components

- **App shell:** Dark indigo/cyan visual system, product narrative, provider status, and responsive layout.
- **Requirement composer:** Prompt textarea, sample prompt action, validation feedback, and run button.
- **Workflow rail:** Shows pending, active, completed, and failed states for each loop stage.
- **Quality dashboard:** Overall score and the six score categories, plus score progression across iterations.
- **Iteration viewer:** Version tabs containing generated code, findings, applied changes, and category scores.
- **Run service/store:** Consumes SSE events, maintains run state, surfaces errors, and persists only the latest completed run in `localStorage`.

The interface is one workspace rather than multiple routed pages. This keeps the presentation direct and the implementation small.

## Data Flow

1. The user enters a requirement or loads the sample prompt.
2. The frontend validates non-empty input and starts a streamed run.
3. The API validates length and selects the configured provider.
4. The orchestrator emits a planning event and obtains the implementation plan.
5. It emits generating and reviewing events for the initial solution.
6. If the review score is below 85 and fewer than three iterations exist, it emits improving, creates the next code version, and reviews again.
7. Each reviewed version is emitted as an iteration event.
8. The orchestrator emits the completed result on early success or after iteration three.
9. The frontend stores the completed result in browser storage and enables inspection and copying.

## Failure Handling

- Requirements outside the accepted length return a clear 400 response.
- Missing Gemini configuration prevents only Gemini-mode runs and returns an actionable message.
- Provider responses are schema-validated. Gemini receives one retry for malformed JSON.
- Provider or network failures emit a terminal error event and preserve already received iterations.
- Stream cancellation ends backend work through the request abort signal where practical.
- Scores are clamped only in the deterministic demo provider; Gemini score data must validate rather than being silently repaired.
- The UI states whether it is using Gemini or Demo mode so the fallback is never misrepresented.

## Testing and Verification

Backend unit tests cover stage order, early stopping at 85, the three-iteration cap, deterministic demo output, schema rejection, and input validation. Frontend tests cover the empty composer state, sample prompt, live workflow states, iteration selection, score rendering, and error messaging.

Before completion, run the full backend and frontend test suites, both production builds, the health endpoint, and one complete streamed demo-mode run. Manually inspect the responsive UI in a browser if browser automation is available.

## Deployment

The repository includes environment templates and deployment notes. The Angular build can deploy to Vercel, while the Express API can deploy to Render or Railway. The frontend receives the API base URL through its environment configuration, and the backend restricts CORS to the deployed frontend URL. Demo mode remains available for a reliable judging walkthrough.

## Submission Deliverables

- Public prototype URL.
- GitHub repository with setup, architecture, environment, testing, and deployment instructions.
- A two-to-three-minute demo video covering the problem, live engineering loop, score progression, iteration comparison, and final result.
- An optional concise pitch outline in the README.

## Acceptance Criteria

- A new checkout starts in Demo mode after documented dependency installation.
- A user can submit the sample requirement and see all workflow stages update during the run.
- The completed run contains one to three inspectable iterations and never exceeds three.
- The run stops early when a review score is at least 85.
- Every reviewed iteration shows all six quality categories and an overall score.
- Gemini mode reads its key only from the backend environment and reports configuration or response errors clearly.
- Refreshing the browser restores the latest completed run.
- Tests and production builds for both applications pass.

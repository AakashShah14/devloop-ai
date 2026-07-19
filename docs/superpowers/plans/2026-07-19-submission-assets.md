# DevLoop AI Submission Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and publicly publish a verified synthetic-narrated demo video and six-slide pitch deck for the DevLoop AI hackathon submission.

**Architecture:** A Playwright capture script records the already deployed application at 1920×1080. Local macOS speech synthesis and FFmpeg produce narration, captions, branded title/closing frames, and the final MP4. The pitch deck is authored with `@oai/artifact-tool`, exported as PowerPoint, converted to PDF, visually inspected, and published with the video under `submission/` in the public GitHub repository.

**Tech Stack:** Playwright, macOS `say`, FFmpeg, `@oai/artifact-tool`, LibreOffice, Git, GitHub.

## Global Constraints

- The demo video must be no longer than 3 minutes; target 2:20–2:45.
- The video must be 1920×1080 MP4 with synthetic English narration and burned-in captions.
- The video must show the public deployed application and must not expose secrets or personal browser data.
- The video must not imply that generated code was executed, compiled, or security-audited.
- The deck must contain six widescreen slides and be delivered as PowerPoint and PDF.
- The deck must use DevLoop’s dark navy, electric green, warm off-white, and existing loop symbol.
- No invented traction, benchmark, customer, or security claims may appear.
- Public GitHub URLs are the guaranteed publication path; YouTube is optional.

---

### Task 1: Capture the working product evidence

**Files:**
- Create: `submission-tools/capture-demo.mjs`
- Create: `/private/tmp/devloop-submission-video/raw/` browser artifacts

**Interfaces:**
- Consumes: `https://devloop-ai.onrender.com/` and the verified Python scaffold requirement.
- Produces: `/private/tmp/devloop-submission-video/raw/devloop.webm` and full-resolution screenshots used by the deck.

- [ ] **Step 1: Create the browser capture script**

Use bundled Playwright to launch an isolated 1920×1080 Chromium context with video recording enabled. Navigate to the deployed URL, wait until the provider badge reads `OpenAI live`, submit this exact requirement, and record through the completed result:

```text
Set up a minimal Python project with pyproject.toml, a src package, pytest tests, .gitignore, and README setup instructions.
```

Capture full-resolution frames for the hero, workflow, quality evidence, project package, and ZIP button. Assert that the final page contains `Python preview`, `Generated project package`, and `Download 5 files as ZIP` before closing the context.

- [ ] **Step 2: Run the capture**

Run with the bundled Node module path so no repository dependency is added:

```bash
NODE_PATH=/Users/aakshshah/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node submission-tools/capture-demo.mjs
```

Expected: exit code 0, a browser video, and five PNG screenshots. If the free Render service is cold, run the script once as a warm-up and use the second capture.

- [ ] **Step 3: Inspect the capture**

Use `ffprobe` to confirm 1920×1080 video and inspect screenshots for API keys, notifications, personal tabs, rendering errors, or an incorrect language label. Reject and recapture if any appear.

- [ ] **Step 4: Commit the reproducible capture script**

```bash
git add submission-tools/capture-demo.mjs
git commit -m "build: add submission demo capture"
```

---

### Task 2: Produce the pitch deck

**Files:**
- Create: `/private/tmp/codex-presentations/devloop-submission/tmp/build-deck.mjs`
- Create: `submission/DevLoop-AI-Pitch-Deck.pptx`
- Create: `submission/DevLoop-AI-Pitch-Deck.pdf`

**Interfaces:**
- Consumes: `web/public/branding/devloop-symbol.png` and the verified screenshots from Task 1.
- Produces: a six-slide editable deck and matching public PDF.

- [ ] **Step 1: Initialize the artifact-tool workspace**

Run the presentation skill workspace setup under `/private/tmp/codex-presentations/devloop-submission/tmp` and read the Artifact Tool quick-start/API documentation plus the selected Codex Grid layout references before authoring.

- [ ] **Step 2: Author six slides**

Build these exact narrative beats using 16:9 layouts, minimum 50pt deck title, 35pt slide titles, 24pt callouts, and 16pt body copy:

1. `DevLoop AI` / `The first answer is just the beginning.`
2. `AI code can look finished before it is engineered.` Show four visible risks: missed requirements, fragile errors, weak accessibility, and hidden maintainability cost.
3. `DevLoop makes improvement visible and bounded.` Show plan → generate → review → improve with stop condition `score ≥ 85 or 3 reviewed iterations`.
4. `A working product leaves an evidence trail.` Use product screenshots to show workflow, six scores, iteration evidence, correct Python project label, and ZIP output.
5. `The application owns the loop—and its limits.` Show Angular → Express/TypeScript → OpenAI Structured Outputs, with Zod validation and SSE; state server-side keys and no generated-code execution.
6. `Better first drafts come from visible engineering.` Close with the public prototype and repository URLs plus the DevLoop symbol.

- [ ] **Step 3: Export PowerPoint and PDF**

Export the artifact-tool presentation to `submission/DevLoop-AI-Pitch-Deck.pptx`, then convert it with LibreOffice to `submission/DevLoop-AI-Pitch-Deck.pdf`.

- [ ] **Step 4: Render and inspect every slide**

Render all six slides to PNG, run the slide overflow test, inspect every slide at full size, and fix clipping, wrapping, contrast, and unintended overlaps. Re-export and repeat until the overflow test passes and visual inspection is clean.

- [ ] **Step 5: Commit the verified deck**

```bash
git add submission/DevLoop-AI-Pitch-Deck.pptx submission/DevLoop-AI-Pitch-Deck.pdf
git commit -m "docs: add DevLoop AI pitch deck"
```

---

### Task 3: Produce the narrated demo video

**Files:**
- Create: `submission-tools/narration.txt`
- Create: `submission-tools/captions.srt`
- Create: `submission-tools/compose-demo.sh`
- Create: `submission/DevLoop-AI-Demo.mp4`

**Interfaces:**
- Consumes: the raw Playwright footage, DevLoop symbol, and verified product screenshots.
- Produces: a captioned H.264/AAC MP4 below three minutes.

- [ ] **Step 1: Write the final narration**

Write approximately 320–360 spoken words covering problem, bounded loop, live OpenAI product, Python result, scores and evidence, ZIP package, safeguards, and closing tagline. Explicitly say: `Quality scores are structured model evaluations; DevLoop does not execute or security-audit generated code.`

- [ ] **Step 2: Generate narration audio**

Run:

```bash
say -v Samantha -r 175 -f submission-tools/narration.txt -o /private/tmp/devloop-submission-video/narration.aiff
```

Convert to AAC-compatible 48 kHz audio with FFmpeg and use `ffprobe` to confirm the narration leaves the final video below 180 seconds.

- [ ] **Step 3: Create synchronized captions**

Create `submission-tools/captions.srt` with complete sentences split into readable one- or two-line segments. Each caption must remain on screen long enough to read and must match the spoken narration.

- [ ] **Step 4: Compose the final MP4**

Use FFmpeg to add a short branded title frame, trim dead time from the Playwright recording, align relevant footage to narration, add a closing frame, burn captions, normalize audio, and encode H.264/AAC at 1920×1080 with `yuv420p` for browser compatibility.

- [ ] **Step 5: Verify the complete video**

Run `ffprobe` and confirm duration is below 180 seconds, video is 1920×1080 H.264, and audio is present. Watch the entire MP4, verify every caption, ensure no secret appears, and ensure claims match the product.

- [ ] **Step 6: Commit the verified video package**

```bash
git add submission-tools/narration.txt submission-tools/captions.srt submission-tools/compose-demo.sh submission/DevLoop-AI-Demo.mp4
git commit -m "docs: add DevLoop AI demo video"
```

---

### Task 4: Publish and verify the submission URLs

**Files:**
- Modify: `docs/submission-checklist.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: all verified deliverables from Tasks 1–3.
- Produces: public judge-ready video and pitch-deck URLs.

- [ ] **Step 1: Update submission documentation**

Add a `Submission links` section to the README and place the final public GitHub URLs in the checklist:

```text
Demo video: https://github.com/AakashShah14/devloop-ai/blob/master/submission/DevLoop-AI-Demo.mp4
Pitch deck: https://github.com/AakashShah14/devloop-ai/blob/master/submission/DevLoop-AI-Pitch-Deck.pdf
```

- [ ] **Step 2: Run final repository checks**

Run `git diff --check`, `npm test`, and `npm run build`. Confirm no `.env` or key is tracked and each submission file is below GitHub’s 100 MB per-file limit.

- [ ] **Step 3: Commit and push all final documentation**

```bash
git add README.md docs/submission-checklist.md
git commit -m "docs: publish hackathon submission links"
git push origin master
```

- [ ] **Step 4: Verify public access**

Open the video and PDF GitHub URLs in a logged-out/private browser context. Confirm both return successfully without login or an access request and copy the two URLs into the hackathon form.

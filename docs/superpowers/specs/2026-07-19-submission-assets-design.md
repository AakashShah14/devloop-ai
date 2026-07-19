# DevLoop AI Submission Assets Design

## Goal

Produce the two remaining public submission links without requiring Aakash to record narration or design slides:

1. A maximum-three-minute demo video.
2. An optional pitch deck.

By the end, hackathon judges should understand that DevLoop AI makes AI-generated code more inspectable and reliable by controlling a bounded plan, generate, review, score, and improve loop.

## Audience and message

The audience is the NamasteDev OpenAI Codex Hackathon judging panel. The assets must communicate originality, practical impact, AI fluency, working execution, and responsible limitations.

The central message is:

> DevLoop AI does not stop at the first answer. It exposes a controlled engineering loop that reviews and improves generated work until it reaches a quality threshold or a hard three-iteration limit.

Claims will remain precise: quality scores are model evaluations, and generated projects are not executed, compiled, or security-audited by DevLoop.

## Demo video

### Format

- Runtime target: 2 minutes 20 seconds to 2 minutes 45 seconds; never over 3 minutes.
- Resolution: 1920×1080 MP4.
- Audio: clear synthetic English narration using a neutral system voice.
- Accessibility: concise burned-in captions synchronized with narration.
- Visual source: the deployed public DevLoop AI application, supplemented only by branded title and closing frames.
- Secrets and personal browser data must never appear.

### Story

1. **Problem:** First-pass AI code can look complete while hiding missing requirements and engineering weaknesses.
2. **Differentiator:** DevLoop owns a bounded plan → generate → review → improve loop rather than allowing uncontrolled retries.
3. **Working product:** Show the public application, the `OpenAI live` provider badge, the workflow, a completed Python project result, its scores, review evidence, correct Python label, and five-file ZIP action.
4. **Trust:** State that keys remain server-side and generated code is not executed.
5. **Close:** Reinforce “The first answer is just the beginning.”

The recording will use the already verified Python scaffold result for reliability. It will not pretend that one successful iteration demonstrates multiple score increases. The narration will explain that the loop stops early when the first reviewed result clears 85 and otherwise continues for at most three reviewed iterations.

### Publication

The MP4 will be stored in the public repository under `submission/`. Its GitHub file URL will be the deadline-safe Demo Video URL. If browser access and time allow, the same MP4 may additionally be uploaded to YouTube as an unlisted video, but YouTube is not required for completion.

## Pitch deck

### Format

- Six widescreen slides.
- Deliverables: editable PowerPoint and PDF.
- Visual language: DevLoop’s dark navy canvas, electric green accent, warm off-white type, and existing loop symbol.
- Copy remains judge-facing and low-density.

### Narrative

1. **Title:** DevLoop AI — The first answer is just the beginning.
2. **Problem:** AI-generated code often looks finished before it is engineered.
3. **Solution:** A visible, bounded plan → generate → review → improve loop.
4. **Proof:** Working Angular/Express/OpenAI product with live stages, inspectable iterations, six quality dimensions, and project ZIP output.
5. **Architecture and safeguards:** Server-side keys, structured responses, Zod validation, SSE updates, threshold of 85, maximum three iterations, no generated-code execution.
6. **Impact:** Faster developer feedback with a transparent trail of what changed and why; close with live product and repository links.

No invented traction, user counts, benchmarks, or security claims will appear.

### Publication

The PowerPoint and PDF will be stored under `submission/` and pushed to the public repository. The PDF’s GitHub file URL will be the Pitch Deck URL because it opens publicly without an account; the editable PowerPoint remains available as a secondary download.

## Verification

- Watch the complete MP4 and confirm duration, audio, captions, and absence of secrets.
- Render and inspect every slide at full size.
- Check for clipped text, unintended overlap, unreadable contrast, and inconsistent branding.
- Open the prototype, repository, video, and deck links in a logged-out/private context.
- Keep all files below GitHub’s per-file limit.
- Update `docs/submission-checklist.md` with the final URLs and verification status.

## Scope

This work does not change the application or redeploy it. It produces submission media from the already verified live build. YouTube/Drive publication is optional because it depends on account access; public GitHub URLs are the guaranteed completion path.

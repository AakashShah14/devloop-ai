# DevLoop AI Project ZIP and Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Gemini-backed runs return safe multi-file projects that users can download as ZIP archives, and add a distinctive DevLoop symbol across the app, favicon, and README.

**Architecture:** Extend the shared generation contract with an optional validated file manifest while preserving the required single-file preview. Build ZIPs entirely in the Angular client with a focused service and JSZip; keep the API stateless and the demo provider unchanged. Generate one square raster brand symbol, serve it as a public asset, and retain the accessible HTML wordmark.

**Tech Stack:** TypeScript, Zod, Vitest, Angular 20, Jasmine/Karma, JSZip, Google Gemini structured JSON, PNG public assets.

## Global Constraints

- Preserve the existing plan → generate → review → improve loop and its maximum of 3 reviewed iterations.
- `GenerationResult.code`, `language`, and `changes` remain required; `files` is optional for backward compatibility.
- Accept at most 50 project files, 100,000 characters per file, and 500,000 characters across the manifest.
- Reject absolute paths, empty segments, backslashes, null bytes, `.` segments, and `..` segments before files reach JSZip.
- Do not execute, upload, persist, compile, or claim to have verified generated project files.
- Keep deterministic Demo mode single-file; multi-file ZIP generation is a Gemini-live feature.
- Keep the Gemini API key server-side.
- The logo contains no words, letters, mockup, or watermark and remains recognizable at favicon size.

---

### Task 1: Validate the optional project-file manifest

**Files:**
- Modify: `api/src/domain.ts`
- Modify: `api/src/domain.test.ts`
- Modify: `web/src/app/models.ts`

**Interfaces:**
- Produces: `ProjectFile { path: string; content: string }`
- Produces: `GenerationResult.files?: ProjectFile[]`
- Produces: `projectFileSchema` and the extended `generationResultSchema`

- [ ] **Step 1: Write failing domain tests for valid files and all safety limits**

Add `generationResultSchema` to the import in `api/src/domain.test.ts`, then add:

```ts
const generation = (files: { path: string; content: string }[]) => ({
  code: 'bootstrapApplication(App)',
  language: 'typescript',
  changes: ['Created the project scaffold'],
  files,
});

it('accepts a safe nested project-file manifest', () => {
  expect(
    generationResultSchema.parse(
      generation([
        { path: 'package.json', content: '{"scripts":{"start":"ng serve"}}' },
        { path: 'src/app/app.ts', content: 'export class App {}' },
      ]),
    ).files,
  ).toHaveLength(2);
});

it.each(['../secret', '/etc/passwd', 'C:/Windows/file', 'src\\app.ts', 'src//app.ts', './app.ts', 'src/./app.ts', 'src/../app.ts', 'src/\0app.ts'])(
  'rejects unsafe project path %s',
  (path) => expect(() => generationResultSchema.parse(generation([{ path, content: 'x' }]))).toThrow(),
);

it('rejects more than 50 files', () => {
  const files = Array.from({ length: 51 }, (_, index) => ({ path: `src/file-${index}.ts`, content: 'x' }));
  expect(() => generationResultSchema.parse(generation(files))).toThrow();
});

it('rejects an individual file over 100000 characters', () => {
  expect(() => generationResultSchema.parse(generation([{ path: 'large.txt', content: 'x'.repeat(100001) }]))).toThrow();
});

it('rejects a manifest over 500000 characters in total', () => {
  const files = Array.from({ length: 6 }, (_, index) => ({ path: `part-${index}.txt`, content: 'x'.repeat(90000) }));
  expect(() => generationResultSchema.parse(generation(files))).toThrow();
});
```

- [ ] **Step 2: Run the API domain test and verify it fails**

Run: `npm test --workspace api -- src/domain.test.ts`

Expected: FAIL because `generationResultSchema` does not accept `files` and does not validate paths or sizes.

- [ ] **Step 3: Add the project-file schema and total-size refinement**

Replace `generationResultSchema` in `api/src/domain.ts` with:

```ts
const safeProjectPath = (path: string): boolean => {
  if (!path || path.startsWith('/') || /^[a-zA-Z]:\//.test(path) || path.includes('\\') || path.includes('\0')) return false;
  const segments = path.split('/');
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
};

export const projectFileSchema = z.object({
  path: z.string().min(1).refine(safeProjectPath, 'Project file path must be safe and relative.'),
  content: z.string().max(100_000),
});

export const generationResultSchema = z
  .object({
    code: z.string().min(1),
    language: z.string().min(1),
    changes: z.array(z.string()),
    files: z.array(projectFileSchema).max(50).optional(),
  })
  .refine(
    (result) => (result.files ?? []).reduce((total, file) => total + file.content.length, 0) <= 500_000,
    { message: 'Project file manifest exceeds 500000 characters.', path: ['files'] },
  );

export type ProjectFile = z.infer<typeof projectFileSchema>;
```

In `web/src/app/models.ts`, add and reference the matching client types:

```ts
export interface ProjectFile { path: string; content: string; }
export interface GenerationResult {
  code: string;
  language: string;
  changes: string[];
  files?: ProjectFile[];
}
```

- [ ] **Step 4: Run the domain test and complete API suite**

Run: `npm test --workspace api -- src/domain.test.ts && npm test --workspace api`

Expected: the focused tests and all API tests PASS.

- [ ] **Step 5: Commit the validated data contract**

```bash
git add api/src/domain.ts api/src/domain.test.ts web/src/app/models.ts
git commit -m "feat: validate generated project manifests"
```

---

### Task 2: Teach Gemini to generate and improve multi-file projects

**Files:**
- Modify: `api/src/providers/gemini-provider.ts`
- Modify: `api/src/providers/gemini-provider.test.ts`

**Interfaces:**
- Consumes: `GenerationResult.files?: ProjectFile[]` from Task 1
- Produces: generation and improvement prompts that request a file manifest only for scaffolds, setup requests, or explicitly multi-file work

- [ ] **Step 1: Write failing prompt-contract tests**

Add to `api/src/providers/gemini-provider.test.ts`:

```ts
it('requests a runnable project manifest for project scaffolding', async () => {
  const generateText = vi.fn().mockResolvedValue(JSON.stringify({
    code: 'bootstrapApplication(App)',
    language: 'typescript',
    changes: ['Created Angular scaffold'],
    files: [{ path: 'package.json', content: '{"scripts":{"start":"ng serve"}}' }],
  }));
  const provider = new GeminiProvider({ apiKey: 'test-key', generateText });

  const result = await provider.generate('Set up an initial Angular 21 app', {
    summary: 'Scaffold Angular',
    steps: ['Create configuration and source files'],
  });

  expect(result.files?.[0].path).toBe('package.json');
  expect(generateText.calls.mostRecent().args[0]).toContain('optional "files" array');
  expect(generateText.calls.mostRecent().args[0]).toContain('package manifest');
  expect(generateText.calls.mostRecent().args[0]).toContain('README');
});

it('preserves the project manifest while improving an iteration', async () => {
  const generateText = vi.fn().mockResolvedValue(JSON.stringify({
    code: 'bootstrapApplication(App)',
    language: 'typescript',
    changes: ['Added tests'],
    files: [{ path: 'src/app/app.spec.ts', content: "it('renders', () => {})" }],
  }));
  const provider = new GeminiProvider({ apiKey: 'test-key', generateText });

  await provider.improve(
    'Set up an initial Angular 21 app',
    { summary: 'Scaffold Angular', steps: ['Create files'] },
    'bootstrapApplication(App)',
    { scores: completeScores, findings: ['Add a component test'] },
    2,
  );

  expect(generateText.calls.mostRecent().args[0]).toContain('return the complete updated manifest');
});
```

- [ ] **Step 2: Run the Gemini provider tests and verify they fail**

Run: `npm test --workspace api -- src/providers/gemini-provider.test.ts`

Expected: FAIL because current prompts neither describe `files` nor require a complete improved manifest.

- [ ] **Step 3: Add one reusable manifest instruction and apply it to both prompts**

Add near `cleanJson` in `api/src/providers/gemini-provider.ts`:

```ts
const projectManifestInstruction = `The JSON may include an optional "files" array with objects shaped {"path":"relative/path","content":"complete file content"}. Include it when the requirement asks for project setup, scaffolding, a repository, or multiple files. For a runnable Angular scaffold include package manifest, Angular configuration, TypeScript configuration, application entry point, component files, styles, tests, and a README with install and run commands. Use normalized relative paths only. Keep "code" as the representative entry file or a concise project overview.`;
```

Change the final paragraph of the generation prompt to:

```ts
Return only JSON: {"code":"complete code or representative entry file","language":"language id","changes":["what this version added"],"files":[{"path":"relative/path","content":"complete content"}]}. ${projectManifestInstruction} Do not use Markdown fences inside strings.
```

Change the final paragraph of the improvement prompt to:

```ts
Return only JSON: {"code":"complete improved code or representative entry file","language":"language id","changes":["specific applied change"],"files":[{"path":"relative/path","content":"complete content"}]}. ${projectManifestInstruction} If the current requirement is multi-file, return the complete updated manifest, not only changed files. Do not use Markdown fences inside strings.
```

- [ ] **Step 4: Run provider and full API tests**

Run: `npm test --workspace api -- src/providers/gemini-provider.test.ts && npm test --workspace api`

Expected: all Gemini provider tests and all API tests PASS.

- [ ] **Step 5: Commit Gemini multi-file generation**

```bash
git add api/src/providers/gemini-provider.ts api/src/providers/gemini-provider.test.ts
git commit -m "feat: request runnable project manifests from Gemini"
```

---

### Task 3: Build ZIP archives in the Angular client

**Files:**
- Modify: `web/package.json`
- Modify: `package-lock.json`
- Modify: `web/package-lock.json` if npm updates the workspace-local lock
- Create: `web/src/app/project-download.service.ts`
- Create: `web/src/app/project-download.service.spec.ts`

**Interfaces:**
- Consumes: `ProjectFile[]`
- Produces: `ProjectDownloadService.createArchive(files): Promise<Blob>`
- Produces: `ProjectDownloadService.archiveName(requirement, iteration): string`
- Produces: `ProjectDownloadService.download(files, requirement, iteration): Promise<void>`

- [ ] **Step 1: Install JSZip**

Run: `npm install jszip --workspace web`

Expected: `jszip` appears in the web workspace dependencies and the applicable lockfile is updated.

- [ ] **Step 2: Write failing ZIP content and filename tests**

Create `web/src/app/project-download.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import JSZip from 'jszip';
import { ProjectDownloadService } from './project-download.service';

describe('ProjectDownloadService', () => {
  let service: ProjectDownloadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectDownloadService);
  });

  it('preserves nested project paths in the ZIP', async () => {
    const blob = await service.createArchive([
      { path: 'package.json', content: '{"name":"demo"}' },
      { path: 'src/app/app.ts', content: 'export class App {}' },
    ]);
    const archive = await JSZip.loadAsync(blob);

    expect(await archive.file('package.json')?.async('string')).toContain('demo');
    expect(await archive.file('src/app/app.ts')?.async('string')).toContain('class App');
  });

  it('creates a conservative archive filename', () => {
    expect(service.archiveName('Set up an Initial Angular 21 App!', 3)).toBe(
      'devloop-set-up-an-initial-angular-21-app-v3.zip',
    );
  });

  it('falls back when the requirement has no filename-safe words', () => {
    expect(service.archiveName('✨✨✨✨✨✨✨✨✨✨', 2)).toBe('devloop-project-v2.zip');
  });

  it('rejects unsafe paths before they reach JSZip', async () => {
    await expectAsync(service.createArchive([{ path: '../secret', content: 'x' }])).toBeRejectedWithError(
      'Invalid project file manifest.',
    );
  });
});
```

- [ ] **Step 3: Run the focused Angular test and verify it fails**

Run: `npm test --workspace web -- --watch=false --browsers=ChromeHeadless --include=src/app/project-download.service.spec.ts`

Expected: FAIL because `ProjectDownloadService` does not exist.

- [ ] **Step 4: Implement ZIP creation, safe naming, and browser download**

Create `web/src/app/project-download.service.ts`:

```ts
import { Injectable } from '@angular/core';
import JSZip from 'jszip';
import type { ProjectFile } from './models';

@Injectable({ providedIn: 'root' })
export class ProjectDownloadService {
  async createArchive(files: ProjectFile[]): Promise<Blob> {
    this.assertSafeFiles(files);
    const zip = new JSZip();
    for (const file of files) zip.file(file.path, file.content);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  archiveName(requirement: string, iteration: number): string {
    const slug = requirement
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48)
      .replace(/-$/g, '');
    return `devloop-${slug || 'project'}-v${iteration}.zip`;
  }

  async download(files: ProjectFile[], requirement: string, iteration: number): Promise<void> {
    const blob = await this.createArchive(files);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = this.archiveName(requirement, iteration);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private assertSafeFiles(files: ProjectFile[]): void {
    const pathsAreSafe = files.length > 0 && files.length <= 50 && files.every((file) => {
      const segments = file.path.split('/');
      return file.content.length <= 100_000
        && !file.path.startsWith('/')
        && !/^[a-zA-Z]:\//.test(file.path)
        && !file.path.includes('\\')
        && !file.path.includes('\0')
        && segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..');
    });
    const totalSize = files.reduce((total, file) => total + file.content.length, 0);
    if (!pathsAreSafe || totalSize > 500_000) throw new Error('Invalid project file manifest.');
  }
}
```

- [ ] **Step 5: Run the focused ZIP tests and full Angular suite**

Run: `npm test --workspace web -- --watch=false --browsers=ChromeHeadless --include=src/app/project-download.service.spec.ts && npm test --workspace web -- --watch=false --browsers=ChromeHeadless`

Expected: focused ZIP tests and all Angular tests PASS.

- [ ] **Step 6: Commit the ZIP service and dependency**

```bash
git add package-lock.json web/package.json web/package-lock.json web/src/app/project-download.service.ts web/src/app/project-download.service.spec.ts
git commit -m "feat: create project ZIP archives in the browser"
```

---

### Task 4: Add the conditional download experience

**Files:**
- Modify: `web/src/app/app.ts`
- Modify: `web/src/app/app.html`
- Modify: `web/src/app/app.css`
- Modify: `web/src/app/app.spec.ts`

**Interfaces:**
- Consumes: `ProjectDownloadService.download(files, requirement, iteration)`
- Produces: `downloadProject(): Promise<void>` and `downloadError` signal
- UI contract: render `[data-testid="download-project"]` only when the selected iteration has files

- [ ] **Step 1: Write failing component tests for conditional rendering and errors**

Add `ProjectDownloadService` to imports in `web/src/app/app.spec.ts`, create `const download = jasmine.createSpy('download');`, add `{ provide: ProjectDownloadService, useValue: { download } }` to providers, reset the spy in `beforeEach`, and add:

```ts
it('hides project download for a single-file iteration', () => {
  iterations.set([iteration]);
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();

  expect(
    (fixture.nativeElement as HTMLElement).querySelector('[data-testid="download-project"]'),
  ).toBeNull();
});

it('downloads every file from the selected project iteration', async () => {
  const files = [
    { path: 'package.json', content: '{"name":"demo"}' },
    { path: 'src/app/app.ts', content: 'export class App {}' },
  ];
  iterations.set([{ ...iteration, files }]);
  result.set({
    requirement: 'Set up an initial Angular 21 app',
    provider: 'gemini',
    plan: { summary: 'Scaffold Angular', steps: ['Create files'] },
    iterations: [{ ...iteration, files }],
    completedAt: '2026-07-19T10:00:00.000Z',
  });
  download.and.resolveTo();
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  const button = (fixture.nativeElement as HTMLElement).querySelector(
    '[data-testid="download-project"]',
  ) as HTMLButtonElement;

  expect(button.textContent).toContain('2 files');
  button.click();
  await fixture.whenStable();

  expect(download).toHaveBeenCalledWith(files, 'Set up an initial Angular 21 app', 1);
});

it('shows an accessible message when ZIP creation fails', async () => {
  iterations.set([{ ...iteration, files: [{ path: 'package.json', content: '{}' }] }]);
  result.set({
    requirement: 'Set up an initial Angular 21 app',
    provider: 'gemini',
    plan: { summary: 'Scaffold Angular', steps: ['Create files'] },
    iterations: [],
    completedAt: '2026-07-19T10:00:00.000Z',
  });
  download.and.rejectWith(new Error('ZIP failed'));
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();

  ((fixture.nativeElement as HTMLElement).querySelector('[data-testid="download-project"]') as HTMLButtonElement).click();
  await fixture.whenStable();
  fixture.detectChanges();

  expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="download-error"]')?.textContent)
    .toContain('Could not create the project ZIP');
});
```

- [ ] **Step 2: Run the component tests and verify they fail**

Run: `npm test --workspace web -- --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts`

Expected: FAIL because the project download action and service injection are absent.

- [ ] **Step 3: Add component download state and behavior**

In `web/src/app/app.ts`, import and inject `ProjectDownloadService`, add `downloadError`, clear it on iteration/new-run changes, and add:

```ts
protected readonly downloadError = signal('');
private readonly projectDownload = inject(ProjectDownloadService);

protected async downloadProject(): Promise<void> {
  const iteration = this.selectedIteration();
  const requirement = this.store.result()?.requirement ?? this.requirement.value.trim();
  if (!iteration?.files?.length) return;
  this.downloadError.set('');
  try {
    await this.projectDownload.download(iteration.files, requirement, iteration.number);
  } catch {
    this.downloadError.set('Could not create the project ZIP. Your generated code is still available above.');
  }
}
```

- [ ] **Step 4: Add the file-count action and accessible status to the code card**

In `web/src/app/app.html`, keep the existing copy button and add below the code preview:

```html
@if (selectedIteration()?.files?.length; as fileCount) {
  <div class="project-download">
    <div>
      <strong>Runnable project package</strong>
      <span>{{ fileCount }} files · AI-generated, not executed by DevLoop</span>
    </div>
    <button
      data-testid="download-project"
      type="button"
      class="download-button"
      (click)="downloadProject()"
    >Download project ZIP ↓</button>
  </div>
}
@if (downloadError()) {
  <p data-testid="download-error" class="download-error" role="alert">{{ downloadError() }}</p>
}
```

Add to `web/src/app/app.css`:

```css
.project-download { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:15px; border-top:1px solid #20314d; background:linear-gradient(100deg,rgba(23,52,73,.72),rgba(31,27,69,.65)); }
.project-download strong,.project-download span { display:block; }
.project-download strong { font-size:12px; color:#e7f8ff; }
.project-download span { margin-top:4px; font-size:10px; color:var(--muted); }
.download-button { flex:0 0 auto; border:1px solid rgba(83,226,241,.45)!important; border-radius:9px; padding:10px 13px; color:#06151c!important; background:linear-gradient(110deg,#65ebf6,#8e8bff)!important; font-weight:750; }
.download-error { margin:0; padding:10px 15px; border-top:1px solid rgba(255,103,116,.35); color:#ffc3ca; background:rgba(105,31,45,.18); font-size:11px; }
@media (max-width:600px) { .project-download { align-items:flex-start; flex-direction:column; }.download-button { width:100%; } }
```

- [ ] **Step 5: Run component and full Angular tests**

Run: `npm test --workspace web -- --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts && npm test --workspace web -- --watch=false --browsers=ChromeHeadless`

Expected: all component and Angular tests PASS; the single-file test confirms no false ZIP action.

- [ ] **Step 6: Commit the download UI**

```bash
git add web/src/app/app.ts web/src/app/app.html web/src/app/app.css web/src/app/app.spec.ts
git commit -m "feat: add project ZIP download experience"
```

---

### Task 5: Generate and apply the DevLoop brand symbol

**Files:**
- Create: `web/public/branding/devloop-symbol.png`
- Create: `web/public/branding/devloop-favicon.png`
- Modify: `web/src/app/app.html`
- Modify: `web/src/app/app.css`
- Modify: `web/src/app/app.spec.ts`
- Modify: `web/src/index.html`
- Modify: `README.md`

**Interfaces:**
- Produces: `/branding/devloop-symbol.png` for header and README
- Produces: `/branding/devloop-favicon.png` for the browser tab
- UI contract: `<img class="brand-symbol" alt="" src="/branding/devloop-symbol.png">` remains decorative because the parent link already has an accessible name

- [ ] **Step 1: Generate the approved square brand symbol**

Use the image-generation tool with this complete prompt:

```text
Use case: brand logo for an AI developer-tool web app. Asset type: square symbol-only logo and favicon source. Create an abstract continuous loop from two interlocking paths with subtle circuit-node details, crisp vector-friendly geometry, luminous cyan and violet on a deep navy background, centered composition, high contrast, restrained glow, and generous edge clearance. The mark must remain recognizable at 32 pixels. No words, no letters, no typography, no device mockup, no presentation board, no watermark.
```

Save the selected generated PNG as `web/public/branding/devloop-symbol.png`; create the favicon-sized PNG as `web/public/branding/devloop-favicon.png` without changing the design.

- [ ] **Step 2: Write a failing header-logo test**

Add to `web/src/app/app.spec.ts`:

```ts
it('renders the DevLoop symbol with the accessible HTML wordmark', () => {
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const symbol = root.querySelector('.brand-symbol') as HTMLImageElement;

  expect(symbol.getAttribute('src')).toBe('/branding/devloop-symbol.png');
  expect(symbol.getAttribute('alt')).toBe('');
  expect(root.querySelector('.brand')?.textContent).toContain('DevLoop AI');
});
```

- [ ] **Step 3: Run the header component test and verify it fails**

Run: `npm test --workspace web -- --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts`

Expected: FAIL because `.brand-symbol` is not rendered.

- [ ] **Step 4: Replace the CSS-only mark, favicon, and README branding**

Replace the header mark in `web/src/app/app.html` with:

```html
<img class="brand-symbol" src="/branding/devloop-symbol.png" alt="" width="34" height="34" />
```

Replace `.brand-mark` rules in `web/src/app/app.css` with:

```css
.brand-symbol { width:34px; height:34px; border-radius:10px; object-fit:cover; box-shadow:0 0 24px rgba(47,216,235,.22); }
```

Replace the favicon link in `web/src/index.html` with:

```html
<link rel="icon" type="image/png" href="/branding/devloop-favicon.png">
```

Add immediately below the README title:

```markdown
<p align="center"><img src="web/public/branding/devloop-symbol.png" alt="DevLoop AI loop symbol" width="144"></p>
```

Add `Downloadable runnable multi-file project ZIPs for Gemini scaffolding requests` to the README demo highlights and explicitly state that generated archives are not executed or compile-verified.

- [ ] **Step 5: Run tests and production build**

Run: `npm test && npm run build`

Expected: all API and Angular tests PASS; both production builds complete successfully.

- [ ] **Step 6: Commit the brand assets and integrations**

```bash
git add web/public/branding web/src/app/app.html web/src/app/app.css web/src/app/app.spec.ts web/src/index.html README.md
git commit -m "feat: add DevLoop brand symbol"
```

---

### Task 6: Verify the complete story, publish, and deploy

**Files:**
- Modify: `docs/demo-video.md`
- Modify: `docs/submission-checklist.md`

**Interfaces:**
- Consumes: complete tested ZIP and logo implementation
- Produces: a reproducible judging walkthrough and deployed `master` build

- [ ] **Step 1: Update the demo instructions with the real multi-file flow**

Add this segment to `docs/demo-video.md`:

```markdown
## Optional Gemini project-package shot

Enter “Set up an initial Angular 21 app with a polished landing page and tests.” After the loop completes, show the generated file count, download the ZIP, and briefly reveal its nested `src/` structure. Say: “DevLoop packages the complete AI-generated project for local inspection; it does not claim the archive was executed or production-verified.”
```

Add these checks to `docs/submission-checklist.md`:

```markdown
- [ ] The DevLoop symbol loads in the header and browser tab.
- [ ] A single-file run has no project ZIP button.
- [ ] A live Gemini scaffold run exposes a ZIP with safe nested paths.
- [ ] The downloaded ZIP opens and contains `package.json`, source files, tests, and README instructions.
- [ ] The UI labels generated project files as not executed by DevLoop.
```

- [ ] **Step 2: Run the complete automated verification**

Run: `npm test && npm run build`

Expected: API tests PASS, Angular tests PASS, API TypeScript compilation succeeds, and Angular production build succeeds.

- [ ] **Step 3: Run browser checks locally**

Run: `npm run dev`

Expected at `http://localhost:4200`: the symbol is sharp at header size; Demo mode still completes 58 → 76 → 91; its single-file result has no ZIP button. With usable Gemini credit, the Angular 21 scaffold request completes, shows a file count, and downloads a ZIP whose nested paths and README are intact.

- [ ] **Step 4: Commit the demo documentation**

```bash
git add docs/demo-video.md docs/submission-checklist.md
git commit -m "docs: add project ZIP judging walkthrough"
```

- [ ] **Step 5: Push master and observe the Render deployment**

Run: `git push origin master`

Expected: GitHub accepts all commits and Render starts a deployment from the updated `master` branch.

- [ ] **Step 6: Verify the deployed service**

Check `https://devloop-ai.onrender.com/api/health` and `https://devloop-ai.onrender.com/`.

Expected: health reports `status: ok`; the deployed header displays the DevLoop symbol; a deterministic run remains usable if Render is switched to Demo mode; a Gemini scaffold run works once the prepaid balance is above $0.

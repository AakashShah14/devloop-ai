import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Iteration, RunResult } from './models';
import { App } from './app';
import { ProjectDownloadService } from './project-download.service';
import { RunStore } from './run.store';

const scoreSet = {
  correctness: 93,
  maintainability: 92,
  security: 88,
  accessibility: 94,
  performance: 89,
  requirementCoverage: 92,
  overall: 91,
};

const iteration: Iteration = {
  number: 1,
  code: '@Component({}) export class Login {}',
  language: 'typescript',
  changes: ['Added typed controls'],
  findings: ['Add integration tests'],
  scores: scoreSet,
};

describe('App', () => {
  const stage = signal<'idle' | 'planning' | 'complete' | 'failed'>('idle');
  const message = signal('Ready to engineer');
  const plan = signal<{ summary: string; steps: string[] } | null>(null);
  const iterations = signal<Iteration[]>([]);
  const result = signal<RunResult | null>(null);
  const provider = signal<'demo' | 'gemini' | 'groq' | 'openai'>('demo');
  const error = signal('');
  const loading = signal(false);
  const start = jasmine.createSpy('start');
  const reset = jasmine.createSpy('reset');
  const download = jasmine.createSpy('download');
  const store = { stage, message, plan, iterations, result, provider, error, loading, start, reset };

  beforeEach(async () => {
    stage.set('idle');
    message.set('Ready to engineer');
    plan.set(null);
    iterations.set([]);
    result.set(null);
    provider.set('demo');
    error.set('');
    loading.set(false);
    start.calls.reset();
    reset.calls.reset();
    download.calls.reset();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: RunStore, useValue: store },
        { provide: ProjectDownloadService, useValue: { download } },
      ],
    }).compileComponents();
  });

  it('renders the product story and workflow stages', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('DevLoop AI');
    expect(text).toContain('Demo mode');
    expect(text).toContain('Planning');
    expect(text).toContain('Generating');
    expect(text).toContain('Reviewing');
    expect(text).toContain('Improving');
  });

  it('renders the DevLoop symbol with the accessible HTML wordmark', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const symbol = root.querySelector('.brand-symbol') as HTMLImageElement | null;

    expect(symbol?.getAttribute('src')).toBe('/branding/devloop-symbol.png');
    expect(symbol?.getAttribute('alt')).toBe('');
    expect(root.querySelector('.brand')?.textContent).toContain('DevLoop AI');
  });

  it('loads the sample requirement and enables the run button', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const runButton = root.querySelector('[data-testid="run-button"]') as HTMLButtonElement;
    expect(runButton.disabled).toBe(true);

    (root.querySelector('[data-testid="sample-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect((root.querySelector('textarea') as HTMLTextAreaElement).value).toContain('Angular login');
    expect(runButton.disabled).toBe(false);
  });

  it('prevents native form navigation when starting a run', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('[data-testid="sample-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const submit = new Event('submit', { bubbles: true, cancelable: true });

    (root.querySelector('form') as HTMLFormElement).dispatchEvent(submit);

    expect(submit.defaultPrevented).toBe(true);
    expect(start).toHaveBeenCalledWith(
      'Create an Angular login component with validation, accessibility, loading state, and error handling.',
    );
  });

  it('renders iteration code and the overall score', () => {
    iterations.set([iteration]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Iteration 1');
    expect(text).toContain('91');
    expect(text).toContain('@Component');
  });

  it('labels the preview from the generated language instead of a hard-coded Angular filename', () => {
    iterations.set([
      {
        ...iteration,
        code: 'def main():\n    print("hello")',
        language: 'python',
      },
    ]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const header = (fixture.nativeElement as HTMLElement).querySelector('.code-card header');

    expect(header?.textContent).toContain('Python preview · v1');
    expect(header?.textContent).not.toContain('login.component.ts');
  });

  it('shows the matching project file path when the preview belongs to a manifest file', () => {
    const code = 'def main():\n    print("hello")';
    iterations.set([
      {
        ...iteration,
        code,
        language: 'python',
        files: [
          { path: 'pyproject.toml', content: '[project]' },
          { path: 'src/demo/main.py', content: code },
        ],
      },
    ]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.code-card header')?.textContent,
    ).toContain('src/demo/main.py · v1');
  });

  it('hides project download for a single-file iteration', () => {
    iterations.set([iteration]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="download-project"]'),
    ).toBeNull();
  });

  it('downloads every file from the selected Python project iteration', async () => {
    const files = [
      { path: 'pyproject.toml', content: '[project]\nname = "demo"' },
      { path: 'src/demo/main.py', content: 'def main():\n    print("hello")' },
    ];
    const projectIteration = { ...iteration, code: 'def main(): pass', language: 'python', files };
    iterations.set([projectIteration]);
    result.set({
      requirement: 'Set up an initial Python project with pytest',
      provider: 'openai',
      plan: { summary: 'Create Python project', steps: ['Create files'] },
      iterations: [projectIteration],
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

    expect(download).toHaveBeenCalledWith(
      files,
      'Set up an initial Python project with pytest',
      1,
    );
  });

  it('shows an accessible message when ZIP creation fails', async () => {
    const projectIteration = {
      ...iteration,
      files: [{ path: 'pyproject.toml', content: '[project]' }],
    };
    iterations.set([projectIteration]);
    result.set({
      requirement: 'Set up an initial Python project with pytest',
      provider: 'openai',
      plan: { summary: 'Create Python project', steps: ['Create files'] },
      iterations: [projectIteration],
      completedAt: '2026-07-19T10:00:00.000Z',
    });
    download.and.rejectWith(new Error('ZIP failed'));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    ((fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="download-project"]',
    ) as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="download-error"]')
        ?.textContent,
    ).toContain('Could not create the project ZIP');
  });

  it('identifies a completed Groq run', () => {
    provider.set('groq');
    result.set({
      requirement: 'Create a Python project with pytest configuration',
      provider: 'groq',
      plan: { summary: 'Create the project', steps: ['Add files'] },
      iterations: [iteration],
      completedAt: '2026-07-19T00:00:00.000Z',
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Groq live');
  });

  it('shows the active OpenAI provider before the first run', () => {
    provider.set('openai');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('OpenAI live');
    expect(fixture.nativeElement.textContent).not.toContain('Demo mode');
  });

  it('prefers current backend health over a restored run provider', () => {
    provider.set('openai');
    result.set({
      requirement: 'Create a Python project with pytest configuration',
      provider: 'groq',
      plan: { summary: 'Create the project', steps: ['Add files'] },
      iterations: [iteration],
      completedAt: '2026-07-19T00:00:00.000Z',
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('OpenAI live');
    expect(fixture.nativeElement.textContent).not.toContain('Groq live');
  });

  it('selects the newest iteration by default', () => {
    iterations.set([
      iteration,
      {
        ...iteration,
        number: 2,
        code: '@Component({}) export class FinalLogin {}',
        scores: { ...scoreSet, overall: 95 },
      },
    ]);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('code')?.textContent).toContain('FinalLogin');
    expect(root.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
      'Iteration 2',
    );
  });

  it('surfaces terminal errors accessibly', () => {
    stage.set('failed');
    error.set('Provider unavailable');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');

    expect(alert?.textContent).toContain('Provider unavailable');
  });
});

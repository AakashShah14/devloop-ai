import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Iteration, RunResult } from './models';
import { App } from './app';
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
  const error = signal('');
  const loading = signal(false);
  const start = jasmine.createSpy('start');
  const reset = jasmine.createSpy('reset');
  const store = { stage, message, plan, iterations, result, error, loading, start, reset };

  beforeEach(async () => {
    stage.set('idle');
    message.set('Ready to engineer');
    plan.set(null);
    iterations.set([]);
    result.set(null);
    error.set('');
    loading.set(false);
    start.calls.reset();
    reset.calls.reset();

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: RunStore, useValue: store }],
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

  it('identifies a completed Groq run', () => {
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

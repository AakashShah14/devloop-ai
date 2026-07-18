import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type { Iteration, RunEvent, RunResult } from './models';
import { RunApiService } from './run-api.service';
import { RunStore } from './run.store';

const iteration: Iteration = {
  number: 1,
  code: '@Component({}) class Login {}',
  language: 'typescript',
  changes: ['Created component'],
  findings: ['Add validation'],
  scores: {
    correctness: 70,
    maintainability: 72,
    security: 68,
    accessibility: 65,
    performance: 80,
    requirementCoverage: 70,
    overall: 71,
  },
};

describe('RunStore', () => {
  let events: Subject<RunEvent>;
  let store: RunStore;

  beforeEach(() => {
    localStorage.clear();
    events = new Subject<RunEvent>();
    TestBed.configureTestingModule({
      providers: [
        RunStore,
        { provide: RunApiService, useValue: { streamRun: () => events.asObservable() } },
      ],
    });
    store = TestBed.inject(RunStore);
  });

  it('starts idle and applies streamed stage and iteration events', () => {
    expect(store.stage()).toBe('idle');

    store.start('Build an accessible Angular login component');
    events.next({ type: 'stage', stage: 'reviewing', message: 'Reviewing iteration 1' });
    events.next({ type: 'iteration', iteration });

    expect(store.stage()).toBe('reviewing');
    expect(store.iterations()).toEqual([iteration]);
    expect(store.latestIteration()).toEqual(iteration);
  });

  it('preserves received iterations when a terminal error arrives', () => {
    store.start('Build an accessible Angular login component');
    events.next({ type: 'iteration', iteration });
    events.next({ type: 'error', message: 'Provider unavailable' });

    expect(store.stage()).toBe('failed');
    expect(store.error()).toBe('Provider unavailable');
    expect(store.iterations()).toHaveSize(1);
  });

  it('persists and restores only a completed result', () => {
    const result: RunResult = {
      requirement: 'Build an accessible Angular login component',
      provider: 'demo',
      plan: { summary: 'Plan', steps: ['Build'] },
      iterations: [iteration],
      completedAt: '2026-07-18T10:00:00.000Z',
    };
    store.start(result.requirement);
    events.next({ type: 'complete', result });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [RunStore, { provide: RunApiService, useValue: { streamRun: () => events } }],
    });
    const restored = TestBed.inject(RunStore);

    expect(restored.result()).toEqual(result);
    expect(restored.stage()).toBe('complete');
  });
});

import { computed, inject, Injectable, signal } from '@angular/core';
import type { Iteration, PlanResult, RunEvent, RunResult, RunStage } from './models';
import { RunApiService } from './run-api.service';

const STORAGE_KEY = 'devloop.latest-run';

@Injectable({ providedIn: 'root' })
export class RunStore {
  private readonly api = inject(RunApiService);
  private readonly stageState = signal<RunStage>('idle');
  private readonly messageState = signal('Ready to engineer');
  private readonly planState = signal<PlanResult | null>(null);
  private readonly iterationsState = signal<Iteration[]>([]);
  private readonly resultState = signal<RunResult | null>(null);
  private readonly errorState = signal('');

  readonly stage = this.stageState.asReadonly();
  readonly message = this.messageState.asReadonly();
  readonly plan = this.planState.asReadonly();
  readonly iterations = this.iterationsState.asReadonly();
  readonly result = this.resultState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loading = computed(() => !['idle', 'complete', 'failed'].includes(this.stageState()));
  readonly latestIteration = computed(() => this.iterationsState().at(-1) ?? null);

  constructor() {
    this.restore();
  }

  start(requirement: string): void {
    this.stageState.set('planning');
    this.messageState.set('Starting the engineering loop');
    this.planState.set(null);
    this.iterationsState.set([]);
    this.resultState.set(null);
    this.errorState.set('');

    this.api.streamRun(requirement).subscribe({
      next: (event) => this.applyEvent(event),
      error: (error: unknown) => {
        this.stageState.set('failed');
        this.errorState.set(
          error instanceof Error ? error.message : 'Unable to start the engineering loop.',
        );
      },
    });
  }

  reset(): void {
    this.stageState.set('idle');
    this.messageState.set('Ready to engineer');
    this.planState.set(null);
    this.iterationsState.set([]);
    this.resultState.set(null);
    this.errorState.set('');
    localStorage.removeItem(STORAGE_KEY);
  }

  private applyEvent(event: RunEvent): void {
    switch (event.type) {
      case 'stage':
        this.stageState.set(event.stage);
        this.messageState.set(event.message);
        break;
      case 'plan':
        this.planState.set(event.plan);
        break;
      case 'iteration':
        this.iterationsState.update((iterations) => [...iterations, event.iteration]);
        break;
      case 'complete':
        this.resultState.set(event.result);
        this.planState.set(event.result.plan);
        this.iterationsState.set(event.result.iterations);
        this.stageState.set('complete');
        this.messageState.set('Engineering loop complete');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(event.result));
        break;
      case 'error':
        this.stageState.set('failed');
        this.errorState.set(event.message);
        break;
    }
  }

  private restore(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const result = JSON.parse(stored) as RunResult;
      if (!result.requirement || !Array.isArray(result.iterations)) return;
      this.resultState.set(result);
      this.planState.set(result.plan);
      this.iterationsState.set(result.iterations);
      this.stageState.set('complete');
      this.messageState.set('Restored your latest engineering loop');
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

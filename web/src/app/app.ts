import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import type { QualityScores, RunStage } from './models';
import { RunStore } from './run.store';

const STAGE_INDEX: Partial<Record<RunStage, number>> = {
  planning: 0,
  generating: 1,
  reviewing: 2,
  improving: 3,
  complete: 4,
};

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly store = inject(RunStore);
  protected readonly requirement = new FormControl('', { nonNullable: true });
  protected readonly selectedNumber = signal(0);
  protected readonly copied = signal(false);
  protected readonly sampleRequirement =
    'Create an Angular login component with validation, accessibility, loading state, and error handling.';
  protected readonly stages = [
    { id: 'planning', label: 'Planning', detail: 'Shape the approach' },
    { id: 'generating', label: 'Generating', detail: 'Build version one' },
    { id: 'reviewing', label: 'Reviewing', detail: 'Score every dimension' },
    { id: 'improving', label: 'Improving', detail: 'Apply the findings' },
    { id: 'complete', label: 'Complete', detail: 'Ship the best result' },
  ] as const;
  protected readonly scoreCards: { key: keyof QualityScores; label: string }[] = [
    { key: 'correctness', label: 'Correctness' },
    { key: 'maintainability', label: 'Maintainability' },
    { key: 'security', label: 'Security' },
    { key: 'accessibility', label: 'Accessibility' },
    { key: 'performance', label: 'Performance' },
    { key: 'requirementCoverage', label: 'Req. coverage' },
  ];
  protected readonly selectedIteration = computed(() => {
    const iterations = this.store.iterations();
    return (
      iterations.find((iteration) => iteration.number === this.selectedNumber()) ??
      iterations.at(-1) ??
      null
    );
  });
  protected readonly providerLabel = computed(() => {
    const provider = this.store.result()?.provider;
    if (provider === 'groq') return 'Groq live';
    if (provider === 'gemini') return 'Gemini live';
    return 'Demo mode';
  });

  protected useSample(): void {
    this.requirement.setValue(this.sampleRequirement);
  }

  protected run(): void {
    const requirement = this.requirement.value.trim();
    if (requirement.length < 10 || this.store.loading()) return;
    this.selectedNumber.set(0);
    this.store.start(requirement);
  }

  protected selectIteration(number: number): void {
    this.selectedNumber.set(number);
    this.copied.set(false);
  }

  protected async copyCode(): Promise<void> {
    const code = this.selectedIteration()?.code;
    if (!code) return;
    await navigator.clipboard.writeText(code);
    this.copied.set(true);
    window.setTimeout(() => this.copied.set(false), 1600);
  }

  protected newRun(): void {
    this.store.reset();
    this.requirement.setValue('');
    this.selectedNumber.set(0);
  }

  protected stageStatus(id: keyof typeof STAGE_INDEX): 'pending' | 'active' | 'done' {
    const current = STAGE_INDEX[this.store.stage()];
    const target = STAGE_INDEX[id] ?? 0;
    if (this.store.stage() === 'complete' || (current !== undefined && current > target)) return 'done';
    if (current === target) return 'active';
    return 'pending';
  }

  protected trackIteration(_index: number, iteration: { number: number }): number {
    return iteration.number;
  }
}

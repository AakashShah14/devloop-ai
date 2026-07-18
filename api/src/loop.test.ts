import { describe, expect, it, vi } from 'vitest';
import type { QualityScores, RunEvent } from './domain.js';
import { runEngineeringLoop } from './loop.js';
import type { LoopProvider } from './providers/provider.js';

const scores = (overall: number): QualityScores => ({
  correctness: overall,
  maintainability: overall,
  security: overall,
  accessibility: overall,
  performance: overall,
  requirementCoverage: overall,
  overall,
});

const createProvider = (reviewScores: number[]): LoopProvider => ({
  name: 'demo',
  plan: vi.fn().mockResolvedValue({ summary: 'Build a focused component', steps: ['Create form'] }),
  generate: vi.fn().mockResolvedValue({ code: 'version 1', language: 'typescript', changes: ['Initial'] }),
  review: vi.fn().mockImplementation((_, __, ___, iteration: number) =>
    Promise.resolve({ scores: scores(reviewScores[iteration - 1] ?? 0), findings: ['Improve it'] }),
  ),
  improve: vi.fn().mockImplementation((_, __, ___, ____, nextIteration: number) =>
    Promise.resolve({ code: `version ${nextIteration}`, language: 'typescript', changes: ['Improved'] }),
  ),
});

describe('runEngineeringLoop', () => {
  it('stops after the first review when quality reaches the threshold', async () => {
    const provider = createProvider([91]);
    const events: RunEvent[] = [];

    const result = await runEngineeringLoop({
      requirement: 'Build an accessible Angular login component',
      provider,
      emit: (event) => events.push(event),
    });

    expect(result.iterations).toHaveLength(1);
    expect(provider.improve).not.toHaveBeenCalled();
    expect(events.at(-1)?.type).toBe('complete');
  });

  it('never exceeds three reviewed iterations', async () => {
    const provider = createProvider([55, 72, 83, 99]);
    const events: RunEvent[] = [];

    const result = await runEngineeringLoop({
      requirement: 'Build an accessible Angular login component',
      provider,
      emit: (event) => events.push(event),
    });

    expect(result.iterations.map((iteration) => iteration.scores.overall)).toEqual([55, 72, 83]);
    expect(provider.improve).toHaveBeenCalledTimes(2);
    expect(provider.review).toHaveBeenCalledTimes(3);
    expect(events.filter((event) => event.type === 'iteration')).toHaveLength(3);
  });

  it('emits the visible loop stages in order', async () => {
    const provider = createProvider([60, 90]);
    const events: RunEvent[] = [];

    await runEngineeringLoop({
      requirement: 'Build an accessible Angular login component',
      provider,
      emit: (event) => events.push(event),
    });

    expect(
      events.filter((event) => event.type === 'stage').map((event) => event.stage),
    ).toEqual(['planning', 'generating', 'reviewing', 'improving', 'reviewing', 'complete']);
  });
});

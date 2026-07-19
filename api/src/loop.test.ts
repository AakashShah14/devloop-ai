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

  it('passes the complete project manifest into review and improvement stages', async () => {
    const provider = createProvider([60, 90]);
    vi.mocked(provider.generate).mockResolvedValue({
      code: 'def main():\n    print("hello")',
      language: 'python',
      changes: ['Created the scaffold'],
      files: [
        { path: 'pyproject.toml', content: '[project]\nname = "demo"' },
        { path: 'src/demo/main.py', content: 'def main():\n    print("hello")' },
      ],
    });

    await runEngineeringLoop({
      requirement: 'Set up an initial Python project with pytest',
      provider,
      emit: () => undefined,
    });

    const reviewContext = vi.mocked(provider.review).mock.calls[0][2];
    const improveContext = vi.mocked(provider.improve).mock.calls[0][2];
    expect(reviewContext).toContain('pyproject.toml');
    expect(reviewContext).toContain('src/demo/main.py');
    expect(improveContext).toContain('[project]');
  });

  it('preserves existing files when an improvement returns only changed project files', async () => {
    const provider = createProvider([60, 90]);
    vi.mocked(provider.generate).mockResolvedValue({
      code: 'def main(): pass',
      language: 'python',
      changes: ['Created project'],
      files: [
        { path: 'pyproject.toml', content: '[project]\nname = "demo"' },
        { path: 'src/demo/main.py', content: 'def main(): pass' },
      ],
    });
    vi.mocked(provider.improve).mockResolvedValue({
      code: 'def main():\n    return 1',
      language: 'python',
      changes: ['Improved main'],
      files: [{ path: 'src/demo/main.py', content: 'def main():\n    return 1' }],
    });

    const result = await runEngineeringLoop({
      requirement: 'Set up an initial Python project with pytest',
      provider,
      emit: () => undefined,
    });

    expect(result.iterations[1].files).toEqual([
      { path: 'pyproject.toml', content: '[project]\nname = "demo"' },
      { path: 'src/demo/main.py', content: 'def main():\n    return 1' },
    ]);
  });

  it('rejects a merged project manifest that exceeds the shared file limit', async () => {
    const provider = createProvider([60, 90]);
    vi.mocked(provider.generate).mockResolvedValue({
      code: 'initial',
      language: 'python',
      changes: ['Created project'],
      files: Array.from({ length: 50 }, (_, index) => ({
        path: `src/original-${index}.py`,
        content: 'x',
      })),
    });
    vi.mocked(provider.improve).mockResolvedValue({
      code: 'improved',
      language: 'python',
      changes: ['Added files'],
      files: Array.from({ length: 50 }, (_, index) => ({
        path: `src/new-${index}.py`,
        content: 'x',
      })),
    });

    await expect(
      runEngineeringLoop({
        requirement: 'Set up an initial Python project with pytest',
        provider,
        emit: () => undefined,
      }),
    ).rejects.toThrow();
  });
});

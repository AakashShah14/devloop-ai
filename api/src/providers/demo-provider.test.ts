import { describe, expect, it } from 'vitest';
import { runEngineeringLoop } from '../loop.js';
import { DemoProvider } from './demo-provider.js';

describe('DemoProvider', () => {
  it('produces a deterministic three-step quality progression', async () => {
    const requirement = 'Create an Angular login component with validation and accessibility';

    const first = await runEngineeringLoop({
      requirement,
      provider: new DemoProvider(),
      emit: () => undefined,
    });
    const second = await runEngineeringLoop({
      requirement,
      provider: new DemoProvider(),
      emit: () => undefined,
    });

    expect(first.plan).toEqual(second.plan);
    expect(first.iterations.map((iteration) => iteration.scores.overall)).toEqual([58, 76, 91]);
    expect(first.iterations.map((iteration) => iteration.code)).toEqual(
      second.iterations.map((iteration) => iteration.code),
    );
    expect(first.iterations.every((iteration) => iteration.code.includes('@Component'))).toBe(true);
    expect(first.iterations.every((iteration) => iteration.findings.length > 0)).toBe(true);
    expect(first.iterations.every((iteration) => iteration.changes.length > 0)).toBe(true);
  });
});

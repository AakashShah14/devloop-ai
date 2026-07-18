import type { Iteration, RunEvent, RunResult } from './domain.js';
import type { LoopProvider } from './providers/provider.js';

const QUALITY_THRESHOLD = 85;
const MAX_ITERATIONS = 3;

export async function runEngineeringLoop(input: {
  requirement: string;
  provider: LoopProvider;
  emit: (event: RunEvent) => void;
}): Promise<RunResult> {
  const { requirement, provider, emit } = input;

  emit({
    type: 'stage',
    stage: 'planning',
    message: 'Turning your requirement into an engineering plan',
  });
  const plan = await provider.plan(requirement);
  emit({ type: 'plan', plan });

  emit({
    type: 'stage',
    stage: 'generating',
    message: 'Building the first implementation',
  });
  let generation = await provider.generate(requirement, plan);
  const iterations: Iteration[] = [];

  for (let number = 1; number <= MAX_ITERATIONS; number += 1) {
    emit({ type: 'stage', stage: 'reviewing', message: `Reviewing iteration ${number}` });
    const review = await provider.review(requirement, plan, generation.code, number);
    const iteration: Iteration = { number, ...generation, ...review };
    iterations.push(iteration);
    emit({ type: 'iteration', iteration });

    if (review.scores.overall >= QUALITY_THRESHOLD || number === MAX_ITERATIONS) {
      break;
    }

    emit({
      type: 'stage',
      stage: 'improving',
      message: `Applying review feedback to iteration ${number + 1}`,
    });
    generation = await provider.improve(
      requirement,
      plan,
      generation.code,
      review,
      number + 1,
    );
  }

  emit({ type: 'stage', stage: 'complete', message: 'Engineering loop complete' });
  const result: RunResult = {
    requirement,
    provider: provider.name,
    plan,
    iterations,
    completedAt: new Date().toISOString(),
  };
  emit({ type: 'complete', result });
  return result;
}

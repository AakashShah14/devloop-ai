import {
  generationResultSchema,
  type GenerationResult,
  type Iteration,
  type RunEvent,
  type RunResult,
} from './domain.js';
import type { LoopProvider } from './providers/provider.js';

const QUALITY_THRESHOLD = 85;
const MAX_ITERATIONS = 3;

const generationContext = (generation: GenerationResult): string => {
  if (!generation.files?.length) return generation.code;
  const files = generation.files
    .map((file) => `--- ${file.path} ---\n${file.content}`)
    .join('\n\n');
  return `Representative preview:\n${generation.code}\n\nComplete project files:\n${files}`;
};

const preserveProjectFiles = (
  previous: GenerationResult,
  improved: GenerationResult,
): GenerationResult => {
  if (!previous.files?.length) return improved;
  const files = new Map(previous.files.map((file) => [file.path, file]));
  for (const file of improved.files ?? []) files.set(file.path, file);
  return generationResultSchema.parse({ ...improved, files: [...files.values()] });
};

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
    const context = generationContext(generation);
    const review = await provider.review(requirement, plan, context, number);
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
    generation = preserveProjectFiles(
      generation,
      await provider.improve(requirement, plan, context, review, number + 1),
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

import type { GenerationResult, PlanResult, ReviewResult } from '../domain.js';

export interface LoopProvider {
  readonly name: 'demo' | 'gemini' | 'groq' | 'openai';
  plan(requirement: string): Promise<PlanResult>;
  generate(requirement: string, plan: PlanResult): Promise<GenerationResult>;
  review(
    requirement: string,
    plan: PlanResult,
    code: string,
    iteration: number,
  ): Promise<ReviewResult>;
  improve(
    requirement: string,
    plan: PlanResult,
    code: string,
    review: ReviewResult,
    nextIteration: number,
  ): Promise<GenerationResult>;
}

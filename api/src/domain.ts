import { z } from 'zod';

export const requirementSchema = z.string().trim().min(10).max(2000);

export const qualityScoresSchema = z.object({
  correctness: z.number().min(0).max(100),
  maintainability: z.number().min(0).max(100),
  security: z.number().min(0).max(100),
  accessibility: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
  requirementCoverage: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});

export const planResultSchema = z.object({
  summary: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
});

export const generationResultSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
  changes: z.array(z.string()),
});

export const reviewResultSchema = z.object({
  scores: qualityScoresSchema,
  findings: z.array(z.string()),
});

export type QualityScores = z.infer<typeof qualityScoresSchema>;
export type PlanResult = z.infer<typeof planResultSchema>;
export type GenerationResult = z.infer<typeof generationResultSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;

export interface Iteration extends GenerationResult, ReviewResult {
  number: number;
}

export interface RunResult {
  requirement: string;
  provider: 'demo' | 'gemini';
  plan: PlanResult;
  iterations: Iteration[];
  completedAt: string;
}

export type RunStage = 'planning' | 'generating' | 'reviewing' | 'improving' | 'complete';

export type RunEvent =
  | { type: 'stage'; stage: RunStage; message: string }
  | { type: 'plan'; plan: PlanResult }
  | { type: 'iteration'; iteration: Iteration }
  | { type: 'complete'; result: RunResult }
  | { type: 'error'; message: string };

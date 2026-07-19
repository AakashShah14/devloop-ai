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

const safeProjectPath = (path: string): boolean => {
  if (
    !path ||
    path.startsWith('/') ||
    /^[a-zA-Z]:\//.test(path) ||
    path.includes('\\') ||
    path.includes('\0')
  ) {
    return false;
  }
  return path
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
};

export const projectFileSchema = z.object({
  path: z.string().min(1).refine(safeProjectPath, 'Project file path must be safe and relative.'),
  content: z.string().max(100_000),
});

export const generationResultSchema = z
  .object({
    code: z.string().min(1),
    language: z.string().min(1),
    changes: z.array(z.string()),
    files: z.array(projectFileSchema).max(50).optional(),
  })
  .superRefine((result, context) => {
    const files = result.files ?? [];
    if (files.reduce((total, file) => total + file.content.length, 0) > 500_000) {
      context.addIssue({
        code: 'custom',
        message: 'Project file manifest exceeds 500000 characters.',
        path: ['files'],
      });
    }
    if (new Set(files.map((file) => file.path)).size !== files.length) {
      context.addIssue({
        code: 'custom',
        message: 'Project file paths must be unique.',
        path: ['files'],
      });
    }
  });

export const reviewResultSchema = z.object({
  scores: qualityScoresSchema,
  findings: z.array(z.string()),
});

export type QualityScores = z.infer<typeof qualityScoresSchema>;
export type PlanResult = z.infer<typeof planResultSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;
export type GenerationResult = z.infer<typeof generationResultSchema>;
export type ReviewResult = z.infer<typeof reviewResultSchema>;

export interface Iteration extends GenerationResult, ReviewResult {
  number: number;
}

export interface RunResult {
  requirement: string;
  provider: 'demo' | 'gemini' | 'groq' | 'openai';
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

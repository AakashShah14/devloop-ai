export interface QualityScores {
  correctness: number;
  maintainability: number;
  security: number;
  accessibility: number;
  performance: number;
  requirementCoverage: number;
  overall: number;
}

export type ProviderName = 'demo' | 'gemini' | 'groq' | 'openai';

export interface PlanResult { summary: string; steps: string[]; }
export interface GenerationResult { code: string; language: string; changes: string[]; }
export interface ReviewResult { scores: QualityScores; findings: string[]; }
export interface Iteration extends GenerationResult, ReviewResult { number: number; }
export interface RunResult {
  requirement: string;
  provider: ProviderName;
  plan: PlanResult;
  iterations: Iteration[];
  completedAt: string;
}
export type RunStage = 'idle' | 'planning' | 'generating' | 'reviewing' | 'improving' | 'complete' | 'failed';
export type RunEvent =
  | { type: 'stage'; stage: Exclude<RunStage, 'idle' | 'failed'>; message: string }
  | { type: 'plan'; plan: PlanResult }
  | { type: 'iteration'; iteration: Iteration }
  | { type: 'complete'; result: RunResult }
  | { type: 'error'; message: string };

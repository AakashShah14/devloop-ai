import { GoogleGenAI } from '@google/genai';
import type { z } from 'zod';
import {
  generationResultSchema,
  planResultSchema,
  reviewResultSchema,
  type GenerationResult,
  type PlanResult,
  type ReviewResult,
} from '../domain.js';
import type { LoopProvider } from './provider.js';

type GenerateText = (prompt: string) => Promise<string>;

const cleanJson = (text: string): string =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

const projectManifestInstruction = `The JSON may include a "files" array with objects shaped {"path":"relative/path","content":"complete file content"}. Include the complete runnable project when the requirement asks for setup, scaffolding, a repository, or multiple files. Match the requested ecosystem: for Python include packaging or requirements, source modules, tests, .gitignore, and README instructions; for Angular include package manifest, Angular and TypeScript configuration, application source, styles, tests, and README instructions. Use normalized relative paths only. Keep "code" as the representative entry file or a concise project overview.`;

export class GeminiProvider implements LoopProvider {
  readonly name = 'gemini' as const;
  private readonly generateText: GenerateText;

  constructor(options: { apiKey: string; model?: string; generateText?: GenerateText }) {
    if (!options.apiKey) {
      throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini.');
    }

    if (options.generateText) {
      this.generateText = options.generateText;
      return;
    }

    const ai = new GoogleGenAI({ apiKey: options.apiKey });
    const model = options.model ?? 'gemini-2.5-flash';
    this.generateText = async (prompt: string) => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.2, responseMimeType: 'application/json' },
      });
      if (!response.text) throw new Error('Gemini returned an empty response.');
      return response.text;
    };
  }

  plan(requirement: string): Promise<PlanResult> {
    return this.callStructured(
      `You are the planning stage of DevLoop AI. Create a focused implementation plan for this requirement:\n${requirement}\n\nReturn only JSON with this shape: {"summary":"string","steps":["string"]}. Keep 3-6 concrete steps.`,
      planResultSchema,
    );
  }

  generate(requirement: string, plan: PlanResult): Promise<GenerationResult> {
    return this.callStructured(
      `You are the generation stage of DevLoop AI. Implement the requirement using the plan.\nRequirement: ${requirement}\nPlan: ${JSON.stringify(plan)}\n\nReturn only JSON with code, language, changes, and files when applicable. ${projectManifestInstruction} Do not use Markdown fences inside strings.`,
      generationResultSchema,
    );
  }

  review(
    requirement: string,
    plan: PlanResult,
    code: string,
    iteration: number,
  ): Promise<ReviewResult> {
    return this.callStructured(
      `You are the strict review stage of DevLoop AI. Review iteration ${iteration} against the original requirement and plan. Never claim code was executed.\nRequirement: ${requirement}\nPlan: ${JSON.stringify(plan)}\nCode:\n${code}\n\nReturn only JSON: {"scores":{"correctness":0,"maintainability":0,"security":0,"accessibility":0,"performance":0,"requirementCoverage":0,"overall":0},"findings":["specific finding"]}. Every score must be an integer from 0 to 100 and overall must reflect the six categories.`,
      reviewResultSchema,
    );
  }

  improve(
    requirement: string,
    plan: PlanResult,
    code: string,
    review: ReviewResult,
    nextIteration: number,
  ): Promise<GenerationResult> {
    return this.callStructured(
      `You are the improvement stage of DevLoop AI. Produce iteration ${nextIteration} by applying every actionable review finding.\nRequirement: ${requirement}\nPlan: ${JSON.stringify(plan)}\nCurrent implementation:\n${code}\nReview: ${JSON.stringify(review)}\n\nReturn only JSON with code, language, changes, and files when applicable. ${projectManifestInstruction} For a multi-file requirement, return the complete updated manifest, not only changed files. Do not use Markdown fences inside strings.`,
      generationResultSchema,
    );
  }

  private async callStructured<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await this.generateText(
          attempt === 0 ? prompt : `${prompt}\nYour previous response was invalid. Return only valid JSON matching the exact shape.`,
        );
        return schema.parse(JSON.parse(cleanJson(text)));
      } catch (error) {
        if (attempt === 1) {
          throw new Error('The model returned an invalid structured response.', { cause: error });
        }
      }
    }

    throw new Error('The model returned an invalid structured response.');
  }
}

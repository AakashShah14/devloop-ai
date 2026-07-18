import { z, type ZodType } from 'zod';
import {
  generationResultSchema,
  planResultSchema,
  reviewResultSchema,
  type GenerationResult,
  type PlanResult,
  type ReviewResult,
} from '../domain.js';
import type { LoopProvider } from './provider.js';

interface StructuredRequest {
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

type GenerateText = (request: StructuredRequest) => Promise<string>;

const cleanJson = (text: string): string =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

const unsupportedSchemaKeywords = new Set([
  '$schema',
  'format',
  'maxItems',
  'maxLength',
  'maximum',
  'minItems',
  'minLength',
  'minimum',
  'multipleOf',
  'pattern',
  'uniqueItems',
]);

const toOpenAISchema = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toOpenAISchema);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !unsupportedSchemaKeywords.has(key))
      .map(([key, nestedValue]) => [key, toOpenAISchema(nestedValue)]),
  );
};

const publicMessageForStatus = (status: number): string => {
  if (status === 400) {
    return 'OpenAI could not process this request. Try a shorter or more focused requirement.';
  }
  if (status === 401 || status === 403) {
    return 'OpenAI authentication failed. Check the server API key and project access.';
  }
  if (status === 429) {
    return 'OpenAI is temporarily rate-limited. Please wait a moment and retry.';
  }
  if (status >= 500) {
    return 'OpenAI is temporarily unavailable. Please retry in a moment.';
  }
  return 'OpenAI could not complete the request. Please retry.';
};

export class OpenAIRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterSeconds?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'OpenAIRequestError';
  }
}

export class OpenAIProvider implements LoopProvider {
  readonly name = 'openai' as const;
  private readonly generateText: GenerateText;

  constructor(options: { apiKey: string; model?: string; generateText?: GenerateText }) {
    if (!options.apiKey) {
      throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai.');
    }

    if (options.generateText) {
      this.generateText = options.generateText;
      return;
    }

    const model = options.model ?? 'gpt-5.4-mini';
    this.generateText = async ({ prompt, schemaName, schema }) => {
      let response: Response;
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            reasoning_effort: 'low',
            max_completion_tokens: 16_000,
            response_format: {
              type: 'json_schema',
              json_schema: { name: schemaName, strict: true, schema },
            },
          }),
          signal: AbortSignal.timeout(120_000),
        });
      } catch (error) {
        throw new OpenAIRequestError(
          0,
          error instanceof Error && error.name === 'TimeoutError'
            ? 'OpenAI took too long to respond. Please retry.'
            : 'Unable to reach OpenAI. Please retry in a moment.',
          undefined,
          { cause: error },
        );
      }

      if (!response.ok) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : Number.NaN;
        const rawError = await response.text();
        let upstreamMessage = `OpenAI request failed with status ${response.status}.`;
        try {
          const parsed = JSON.parse(rawError) as { error?: { message?: unknown } };
          if (typeof parsed.error?.message === 'string') upstreamMessage = parsed.error.message;
        } catch {
          if (rawError.trim()) upstreamMessage = rawError.trim();
        }
        throw new OpenAIRequestError(
          response.status,
          publicMessageForStatus(response.status),
          Number.isFinite(retryAfter) ? retryAfter : undefined,
          { cause: new Error(`OpenAI ${response.status}: ${upstreamMessage}`) },
        );
      }

      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>;
      };
      const choice = body.choices?.[0]?.message;
      if (choice?.refusal) {
        throw new OpenAIRequestError(422, 'OpenAI could not fulfill this requirement safely.');
      }
      if (!choice?.content) {
        throw new OpenAIRequestError(502, 'OpenAI returned an empty response. Please retry.');
      }
      return choice.content;
    };
  }

  plan(requirement: string): Promise<PlanResult> {
    return this.callStructured(
      `You are the planning stage of DevLoop AI. Create a focused implementation plan for this requirement:\n${requirement}\n\nReturn only the requested structured result. Keep 3-6 concrete steps.`,
      'devloop_plan',
      planResultSchema,
    );
  }

  generate(requirement: string, plan: PlanResult): Promise<GenerationResult> {
    return this.callStructured(
      `You are the generation stage of DevLoop AI. Implement the requirement using the plan.\nRequirement: ${requirement}\nPlan: ${JSON.stringify(plan)}\n\nReturn complete code and a concise list of changes in the requested structure. Do not use Markdown fences inside the code string.`,
      'devloop_generation',
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
      `You are the strict review stage of DevLoop AI. Review iteration ${iteration} against the original requirement and plan. Never claim code was executed.\nRequirement: ${requirement}\nPlan: ${JSON.stringify(plan)}\nCode:\n${code}\n\nScore every category from 0 to 100. The overall score must reflect all six categories. Return only the requested structured result.`,
      'devloop_review',
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
      `You are the improvement stage of DevLoop AI. Produce iteration ${nextIteration} by applying every actionable review finding.\nRequirement: ${requirement}\nPlan: ${JSON.stringify(plan)}\nCurrent code:\n${code}\nReview: ${JSON.stringify(review)}\n\nReturn complete improved code and the specific applied changes in the requested structure. Do not use Markdown fences inside the code string.`,
      'devloop_generation',
      generationResultSchema,
    );
  }

  private async callStructured<T>(
    prompt: string,
    schemaName: string,
    schema: ZodType<T>,
  ): Promise<T> {
    const jsonSchema = toOpenAISchema(z.toJSONSchema(schema)) as Record<string, unknown>;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let text: string;
      try {
        text = await this.generateText({
          prompt:
            attempt === 0
              ? prompt
              : `${prompt}\nThe previous response did not match the required structure. Return only a valid structured result.`,
          schemaName,
          schema: jsonSchema,
        });
      } catch (error) {
        if (error instanceof OpenAIRequestError) throw error;
        throw new OpenAIRequestError(0, 'Unable to reach OpenAI. Please retry in a moment.', undefined, {
          cause: error,
        });
      }

      try {
        return schema.parse(JSON.parse(cleanJson(text)));
      } catch (error) {
        if (attempt === 1) {
          throw new OpenAIRequestError(
            422,
            'OpenAI returned an invalid structured response. Please retry.',
            undefined,
            { cause: error },
          );
        }
      }
    }

    throw new OpenAIRequestError(422, 'OpenAI returned an invalid structured response. Please retry.');
  }
}

import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from './gemini-provider.js';

const completeScores = {
  correctness: 80,
  maintainability: 81,
  security: 82,
  accessibility: 83,
  performance: 84,
  requirementCoverage: 85,
  overall: 82,
};

describe('GeminiProvider', () => {
  it('accepts JSON wrapped in a Markdown fence', async () => {
    const generateText = vi
      .fn()
      .mockResolvedValue('```json\n{"summary":"A focused plan","steps":["Build the form"]}\n```');
    const provider = new GeminiProvider({ apiKey: 'test-key', generateText });

    await expect(provider.plan('Build an accessible Angular login component')).resolves.toEqual({
      summary: 'A focused plan',
      steps: ['Build the form'],
    });
  });

  it('retries one malformed response and then accepts valid output', async () => {
    const generateText = vi
      .fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify({ scores: completeScores, findings: ['Add tests'] }));
    const provider = new GeminiProvider({ apiKey: 'test-key', generateText });

    const result = await provider.review(
      'Build an accessible Angular login component',
      { summary: 'Plan', steps: ['Build'] },
      'const login = true;',
      1,
    );

    expect(result.scores.overall).toBe(82);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('rejects incomplete score output after one retry', async () => {
    const generateText = vi.fn().mockResolvedValue(
      JSON.stringify({ scores: { overall: 82 }, findings: ['Missing categories'] }),
    );
    const provider = new GeminiProvider({ apiKey: 'test-key', generateText });

    await expect(
      provider.review(
        'Build an accessible Angular login component',
        { summary: 'Plan', steps: ['Build'] },
        'const login = true;',
        1,
      ),
    ).rejects.toThrow('The model returned an invalid structured response.');
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { GroqProvider } from './groq-provider.js';

const completeScores = {
  correctness: 88,
  maintainability: 87,
  security: 86,
  accessibility: 85,
  performance: 84,
  requirementCoverage: 89,
  overall: 87,
};

describe('GroqProvider', () => {
  it('parses a structured planning response', async () => {
    const generateText = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ summary: 'Create the project', steps: ['Add files'] }));
    const provider = new GroqProvider({ apiKey: 'test-key', generateText });

    await expect(provider.plan('Set up an initial Python project with pytest')).resolves.toEqual({
      summary: 'Create the project',
      steps: ['Add files'],
    });
  });

  it('retries one invalid response before accepting valid JSON', async () => {
    const generateText = vi
      .fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify({ scores: completeScores, findings: ['Add tests'] }));
    const provider = new GroqProvider({ apiKey: 'test-key', generateText });

    const result = await provider.review(
      'Set up an initial Python project with pytest',
      { summary: 'Create the project', steps: ['Add files'] },
      'print("hello")',
      1,
    );

    expect(result.scores.overall).toBe(87);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('does not accept a missing API key', () => {
    expect(() => new GroqProvider({ apiKey: '' })).toThrow(
      'GROQ_API_KEY is required when LLM_PROVIDER=groq.',
    );
  });

  it('requests a complete project manifest for Python scaffolding', async () => {
    const generateText = vi.fn().mockResolvedValue(
      JSON.stringify({
        code: 'def main(): pass',
        language: 'python',
        changes: ['Created project'],
        files: [{ path: 'pyproject.toml', content: '[project]' }],
      }),
    );
    const provider = new GroqProvider({ apiKey: 'test-key', generateText });

    const result = await provider.generate('Set up an initial Python project with pytest', {
      summary: 'Create project',
      steps: ['Add files'],
    });

    expect(result.files?.[0].path).toBe('pyproject.toml');
    expect(generateText.mock.calls[0][0]).toContain('complete runnable project');
    expect(generateText.mock.calls[0][0]).toContain('Python');
  });
});

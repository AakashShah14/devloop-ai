import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

describe('readConfig', () => {
  it('reads Groq provider settings', () => {
    const config = readConfig({
      LLM_PROVIDER: 'groq',
      GROQ_API_KEY: 'test-groq-key',
      GROQ_MODEL: 'openai/gpt-oss-120b',
    });

    expect(config.provider).toBe('groq');
    expect(config.groqApiKey).toBe('test-groq-key');
    expect(config.groqModel).toBe('openai/gpt-oss-120b');
  });

  it('requires a Groq key only when Groq is active', () => {
    expect(() => readConfig({ LLM_PROVIDER: 'groq' })).toThrow(
      'GROQ_API_KEY is required when LLM_PROVIDER=groq.',
    );
    expect(() => readConfig({ LLM_PROVIDER: 'demo' })).not.toThrow();
  });
});

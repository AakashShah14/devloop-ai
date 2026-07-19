import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIProvider, OpenAIRequestError } from './openai-provider.js';

const completeScores = {
  correctness: 92,
  maintainability: 90,
  security: 88,
  accessibility: 91,
  performance: 89,
  requirementCoverage: 94,
  overall: 91,
};

describe('OpenAIProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a strict OpenAI-compatible schema and request payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Create the project',
                  steps: ['Add files'],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAIProvider({ apiKey: 'test-key' });

    await provider.plan('Set up an initial Python project with pytest');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(request.body as string) as Record<string, unknown>;
    const bodyText = JSON.stringify(body);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect((request.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(body['model']).toBe('gpt-5.4-mini');
    expect(bodyText).toContain('"type":"json_schema"');
    expect(bodyText).toContain('"strict":true');
    expect(bodyText).toContain('"additionalProperties":false');
    expect(bodyText).not.toContain('"$schema"');
    expect(bodyText).not.toContain('"minLength"');
    expect(bodyText).not.toContain('"minItems"');
    expect(bodyText).not.toContain('"minimum"');
    expect(bodyText).not.toContain('"maximum"');
  });

  it('keeps upstream HTTP detail in the server-side error cause', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: 'Unsupported schema keyword minLength' } }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
    const provider = new OpenAIProvider({ apiKey: 'test-key' });

    try {
      await provider.plan('Set up an initial Python project with pytest');
      expect(false).toBe(true);
    } catch (error) {
      expect(error).toBeInstanceOf(OpenAIRequestError);
      expect((error as Error).message).not.toContain('minLength');
      expect(((error as Error).cause as Error).message).toContain('Unsupported schema keyword');
      expect((error as OpenAIRequestError).retryAfterSeconds).toBeUndefined();
    }
  });

  it('parses a structured planning response', async () => {
    const generateText = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ summary: 'Create the project', steps: ['Add files'] }));
    const provider = new OpenAIProvider({ apiKey: 'test-key', generateText });

    await expect(provider.plan('Set up an initial Python project with pytest')).resolves.toEqual({
      summary: 'Create the project',
      steps: ['Add files'],
    });
  });

  it('requests and accepts a complete Python project manifest', async () => {
    const generateText = vi.fn().mockResolvedValue(
      JSON.stringify({
        code: 'def main():\n    print("hello")',
        language: 'python',
        changes: ['Created a runnable Python project'],
        files: [
          { path: 'pyproject.toml', content: '[project]\nname = "demo"' },
          { path: 'src/demo/main.py', content: 'def main():\n    print("hello")' },
          { path: 'README.md', content: '# Demo' },
        ],
      }),
    );
    const provider = new OpenAIProvider({ apiKey: 'test-key', generateText });

    const result = await provider.generate('Set up an initial Python project with pytest', {
      summary: 'Create the project',
      steps: ['Add packaging, source, tests, and documentation'],
    });

    expect(result.files).toHaveLength(3);
    expect(result.files?.[0].path).toBe('pyproject.toml');
    const request = generateText.mock.calls[0][0] as { prompt: string; schema: object };
    expect(request.prompt).toContain('"files" array');
    expect(request.prompt).toContain('Python');
    expect(request.prompt).toContain('README');
    expect(JSON.stringify(request.schema)).toContain('files');
  });

  it('requires the files array in OpenAI strict generation schemas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  code: 'print("hello")',
                  language: 'python',
                  changes: ['Created the script'],
                  files: [],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAIProvider({ apiKey: 'test-key' });

    await provider.generate('Create one Python script that prints hello', {
      summary: 'Create a script',
      steps: ['Write the script'],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const schema = body.response_format.json_schema.schema as {
      required: string[];
      properties: object;
    };
    expect(schema.required).toContain('files');
    expect(schema.properties).toHaveProperty('files');
  });

  it('asks improvements to return the complete updated project manifest', async () => {
    const generateText = vi.fn().mockResolvedValue(
      JSON.stringify({
        code: 'def main():\n    print("hello")',
        language: 'python',
        changes: ['Added tests'],
        files: [{ path: 'tests/test_main.py', content: 'def test_main():\n    assert True' }],
      }),
    );
    const provider = new OpenAIProvider({ apiKey: 'test-key', generateText });

    await provider.improve(
      'Set up an initial Python project with pytest',
      { summary: 'Create the project', steps: ['Add files'] },
      'Current project files:\npyproject.toml\n[project]',
      { scores: completeScores, findings: ['Add tests'] },
      2,
    );

    expect((generateText.mock.calls[0][0] as { prompt: string }).prompt).toContain(
      'complete updated manifest',
    );
  });

  it('retries one schema-invalid successful response', async () => {
    const generateText = vi
      .fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify({ scores: completeScores, findings: ['Add tests'] }));
    const provider = new OpenAIProvider({ apiKey: 'test-key', generateText });

    const result = await provider.review(
      'Set up an initial Python project with pytest',
      { summary: 'Create the project', steps: ['Add files'] },
      'print("hello")',
      1,
    );

    expect(result.scores.overall).toBe(91);
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it('does not retry an HTTP provider failure as invalid JSON', async () => {
    const generateText = vi
      .fn()
      .mockRejectedValue(new OpenAIRequestError(429, 'OpenAI is temporarily rate-limited.'));
    const provider = new OpenAIProvider({ apiKey: 'test-key', generateText });

    await expect(provider.plan('Set up an initial Python project with pytest')).rejects.toThrow(
      'OpenAI is temporarily rate-limited.',
    );
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('requires a server-side API key', () => {
    expect(() => new OpenAIProvider({ apiKey: '' })).toThrow(
      'OPENAI_API_KEY is required when LLM_PROVIDER=openai.',
    );
  });
});

import 'dotenv/config';

export interface AppConfig {
  provider: 'demo' | 'gemini';
  geminiApiKey: string;
  geminiModel: string;
  port: number;
  clientOrigin: string;
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const provider = environment.LLM_PROVIDER === 'gemini' ? 'gemini' : 'demo';
  const geminiApiKey = environment.GEMINI_API_KEY ?? '';
  if (provider === 'gemini' && !geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini.');
  }

  return {
    provider,
    geminiApiKey,
    geminiModel: environment.GEMINI_MODEL ?? 'gemini-2.5-flash',
    port: Number(environment.PORT ?? 3000),
    clientOrigin: environment.CLIENT_ORIGIN ?? 'http://localhost:4200',
  };
}

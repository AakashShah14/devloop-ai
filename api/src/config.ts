import 'dotenv/config';

export interface AppConfig {
  provider: 'demo' | 'gemini' | 'groq' | 'openai';
  openaiApiKey: string;
  openaiModel: string;
  geminiApiKey: string;
  geminiModel: string;
  groqApiKey: string;
  groqModel: string;
  port: number;
  clientOrigin: string;
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const provider =
    environment.LLM_PROVIDER === 'gemini' ||
    environment.LLM_PROVIDER === 'groq' ||
    environment.LLM_PROVIDER === 'openai'
      ? environment.LLM_PROVIDER
      : 'demo';
  const openaiApiKey = environment.OPENAI_API_KEY ?? '';
  const geminiApiKey = environment.GEMINI_API_KEY ?? '';
  const groqApiKey = environment.GROQ_API_KEY ?? '';
  if (provider === 'openai' && !openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai.');
  }
  if (provider === 'gemini' && !geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required when LLM_PROVIDER=gemini.');
  }
  if (provider === 'groq' && !groqApiKey) {
    throw new Error('GROQ_API_KEY is required when LLM_PROVIDER=groq.');
  }

  return {
    provider,
    openaiApiKey,
    openaiModel: environment.OPENAI_MODEL ?? 'gpt-5.4-mini',
    geminiApiKey,
    geminiModel: environment.GEMINI_MODEL ?? 'gemini-2.5-flash',
    groqApiKey,
    groqModel: environment.GROQ_MODEL ?? 'openai/gpt-oss-120b',
    port: Number(environment.PORT ?? 3000),
    clientOrigin: environment.CLIENT_ORIGIN ?? 'http://localhost:4200',
  };
}

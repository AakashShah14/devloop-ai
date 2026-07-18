import { createApp } from './app.js';
import { readConfig } from './config.js';
import { DemoProvider } from './providers/demo-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';
import { GroqProvider } from './providers/groq-provider.js';
import { OpenAIProvider } from './providers/openai-provider.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const config = readConfig();
const provider =
  config.provider === 'openai'
    ? new OpenAIProvider({ apiKey: config.openaiApiKey, model: config.openaiModel })
    : config.provider === 'gemini'
    ? new GeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel })
    : config.provider === 'groq'
      ? new GroqProvider({ apiKey: config.groqApiKey, model: config.groqModel })
    : new DemoProvider(() => new Promise((resolve) => setTimeout(resolve, 420)));

const webDistPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist/web/browser');

createApp({ provider, clientOrigin: config.clientOrigin, webDistPath }).listen(config.port, () => {
  console.log(`DevLoop API running on http://localhost:${config.port} in ${provider.name} mode`);
});

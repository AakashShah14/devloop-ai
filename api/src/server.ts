import { createApp } from './app.js';
import { readConfig } from './config.js';
import { DemoProvider } from './providers/demo-provider.js';
import { GeminiProvider } from './providers/gemini-provider.js';

const config = readConfig();
const provider =
  config.provider === 'gemini'
    ? new GeminiProvider({ apiKey: config.geminiApiKey, model: config.geminiModel })
    : new DemoProvider();

createApp({ provider, clientOrigin: config.clientOrigin }).listen(config.port, () => {
  console.log(`DevLoop API running on http://localhost:${config.port} in ${provider.name} mode`);
});

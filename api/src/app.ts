import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { requirementSchema, type RunEvent } from './domain.js';
import { runEngineeringLoop } from './loop.js';
import type { LoopProvider } from './providers/provider.js';

const writeEvent = (response: express.Response, event: RunEvent): void => {
  response.write(`event: ${event.type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
};

export function createApp(options: { provider: LoopProvider; clientOrigin: string }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: options.clientOrigin }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok', provider: options.provider.name });
  });

  app.post('/api/runs', async (request, response) => {
    const requirementResult = requirementSchema.safeParse(request.body?.requirement);
    if (!requirementResult.success) {
      response.status(400).json({ message: 'Requirement must contain between 10 and 2000 characters.' });
      return;
    }

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();

    try {
      await runEngineeringLoop({
        requirement: requirementResult.data,
        provider: options.provider,
        emit: (event) => writeEvent(response, event),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('GEMINI_API_KEY')
          ? error.message
          : 'The engineering loop could not finish. Please retry or switch to Demo mode.';
      writeEvent(response, { type: 'error', message });
    } finally {
      response.end();
    }
  });

  return app;
}

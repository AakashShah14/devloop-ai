import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.js';
import { DemoProvider } from './providers/demo-provider.js';
import type { LoopProvider } from './providers/provider.js';

const app = createApp({
  provider: new DemoProvider(),
  clientOrigin: 'http://localhost:4200',
});

describe('DevLoop API', () => {
  it('reports health without exposing configuration secrets', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', provider: 'demo' });
  });

  it('rejects requirements shorter than ten characters', async () => {
    const response = await request(app).post('/api/runs').send({ requirement: 'short' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('10');
  });

  it('streams the complete deterministic engineering loop', async () => {
    const response = await request(app).post('/api/runs').send({
      requirement: 'Create an Angular login component with validation and accessibility',
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('event: stage');
    expect(response.text).toContain('event: iteration');
    expect(response.text).toContain('event: complete');
    expect((response.text.match(/event: iteration/g) ?? [])).toHaveLength(3);
  });

  it('reports provider failures to the server error handler', async () => {
    const providerError = new Error('upstream request failed');
    const failingProvider: LoopProvider = {
      name: 'gemini',
      plan: async () => Promise.reject(providerError),
      generate: async () => Promise.reject(providerError),
      review: async () => Promise.reject(providerError),
      improve: async () => Promise.reject(providerError),
    };
    const onError = vi.fn();
    const failingApp = createApp({
      provider: failingProvider,
      clientOrigin: 'http://localhost:4200',
      onError,
    });

    await request(failingApp).post('/api/runs').send({
      requirement: 'Create a Python project with pytest configuration',
    });

    expect(onError).toHaveBeenCalledWith(providerError);
  });

  it('serves the Angular app when a production build path is provided', async () => {
    const webDistPath = await mkdtemp(join(tmpdir(), 'devloop-web-'));
    await writeFile(join(webDistPath, 'index.html'), '<main>DevLoop production app</main>');
    const productionApp = createApp({
      provider: new DemoProvider(),
      clientOrigin: 'https://devloop.example',
      webDistPath,
    });

    const response = await request(productionApp).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('DevLoop production app');
  });
});

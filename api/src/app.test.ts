import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { DemoProvider } from './providers/demo-provider.js';

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
});

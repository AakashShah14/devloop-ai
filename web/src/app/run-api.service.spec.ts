import { TestBed } from '@angular/core/testing';
import { lastValueFrom, toArray } from 'rxjs';
import { RunApiService } from './run-api.service';

describe('RunApiService', () => {
  let service: RunApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [RunApiService] });
    service = TestBed.inject(RunApiService);
  });

  afterEach(() => jasmine.getEnv().allowRespy(true));

  it('reads the active provider from the health endpoint', async () => {
    spyOn(window, 'fetch').and.resolveTo(
      new Response(JSON.stringify({ status: 'ok', provider: 'openai' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expectAsync(service.getProvider()).toBeResolvedTo('openai');
    expect(window.fetch).toHaveBeenCalledWith('/api/health');
  });

  it('reconstructs SSE records split across response chunks', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: stage\ndata: {"type":"stage","stage":"planning",',
      '"message":"Planning"}\n\nevent: plan\ndata: {"type":"plan","plan":{"summary":"Ready",',
      '"steps":["Build"]}}\n\n',
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
        controller.close();
      },
    });
    spyOn(window, 'fetch').and.resolveTo(new Response(stream, { status: 200 }));

    const events = await lastValueFrom(service.streamRun('Build an accessible login').pipe(toArray()));

    expect(events.map((event) => event.type)).toEqual(['stage', 'plan']);
  });

  it('returns a useful message when the API rejects the request', async () => {
    spyOn(window, 'fetch').and.resolveTo(new Response('', { status: 500 }));

    await expectAsync(lastValueFrom(service.streamRun('Build an accessible login'))).toBeRejectedWithError(
      'Unable to start the engineering loop.',
    );
  });
});

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { RunEvent } from './models';

@Injectable({ providedIn: 'root' })
export class RunApiService {
  streamRun(requirement: string): Observable<RunEvent> {
    return new Observable<RunEvent>((observer) => {
      const controller = new AbortController();

      void (async () => {
        try {
          const response = await fetch('/api/runs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requirement }),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error('Unable to start the engineering loop.');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value, { stream: !done });
            const records = buffer.split(/\r?\n\r?\n/);
            buffer = records.pop() ?? '';

            for (const record of records) {
              const data = record
                .split(/\r?\n/)
                .filter((line) => line.startsWith('data:'))
                .map((line) => line.slice(5).trimStart())
                .join('\n');
              if (data) observer.next(JSON.parse(data) as RunEvent);
            }

            if (done) break;
          }

          observer.complete();
        } catch (error) {
          if (!controller.signal.aborted) {
            observer.error(
              error instanceof Error
                ? error
                : new Error('Unable to start the engineering loop.'),
            );
          }
        }
      })();

      return () => controller.abort();
    });
  }
}

import { describe, expect, it } from 'vitest';
import { generationResultSchema, qualityScoresSchema, requirementSchema } from './domain.js';

const generation = (files: { path: string; content: string }[]) => ({
  code: 'print("hello")',
  language: 'python',
  changes: ['Created the Python scaffold'],
  files,
});

describe('domain validation', () => {
  it('rejects an incomplete quality score set', () => {
    expect(() => qualityScoresSchema.parse({ overall: 80 })).toThrow();
  });

  it('accepts a requirement between 10 and 2000 characters', () => {
    expect(requirementSchema.parse('Build an accessible Angular login form')).toBeTruthy();
  });

  it('rejects a requirement shorter than 10 characters', () => {
    expect(() => requirementSchema.parse('login')).toThrow();
  });

  it('accepts a safe nested project-file manifest', () => {
    expect(
      generationResultSchema.parse(
        generation([
          { path: 'pyproject.toml', content: '[project]\nname = "demo"' },
          { path: 'src/demo/__init__.py', content: '' },
        ]),
      ).files,
    ).toHaveLength(2);
  });

  it.each([
    '../secret',
    '/etc/passwd',
    'C:/Windows/file',
    'src\\app.py',
    'src//app.py',
    './app.py',
    'src/./app.py',
    'src/../app.py',
    'src/\0app.py',
  ])('rejects unsafe project path %s', (path) => {
    expect(() => generationResultSchema.parse(generation([{ path, content: 'x' }]))).toThrow();
  });

  it('rejects unsafe manifest sizes', () => {
    const tooMany = Array.from({ length: 51 }, (_, index) => ({
      path: `src/file-${index}.py`,
      content: 'x',
    }));
    expect(() => generationResultSchema.parse(generation(tooMany))).toThrow();
    expect(() =>
      generationResultSchema.parse(
        generation([{ path: 'large.txt', content: 'x'.repeat(100_001) }]),
      ),
    ).toThrow();
    expect(() =>
      generationResultSchema.parse(
        generation(
          Array.from({ length: 6 }, (_, index) => ({
            path: `part-${index}.txt`,
            content: 'x'.repeat(90_000),
          })),
        ),
      ),
    ).toThrow();
  });

  it('rejects duplicate project paths', () => {
    expect(() =>
      generationResultSchema.parse(
        generation([
          { path: 'src/main.py', content: 'print("first")' },
          { path: 'src/main.py', content: 'print("second")' },
        ]),
      ),
    ).toThrow();
  });
});

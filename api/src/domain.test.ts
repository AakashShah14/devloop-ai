import { describe, expect, it } from 'vitest';
import { qualityScoresSchema, requirementSchema } from './domain.js';

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
});

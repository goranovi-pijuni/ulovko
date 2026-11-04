import { describe, it, expect, beforeEach } from 'vitest';
import { CompetitionsService } from './competitions.service.js';

describe('CompetitionsService', () => {
  let service: CompetitionsService;

  beforeEach(() => {
    service = new CompetitionsService();
  });

  it('should return undefined for nonexistent IDs', () => {
    expect(service.findById(999)).toBeUndefined();
  });
});

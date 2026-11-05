import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitionsService } from './competitions.service.js';
import type { DatabaseService } from '../database/database.service.js';

const row = {
  id: 3,
  name: 'FER CTF',
  description: null,
  startsAt: new Date('2026-11-05T11:00:00Z'),
  endsAt: new Date('2026-11-05T13:00:00Z'),
  organisedBy: 7,
  teamCount: 2,
};

describe('CompetitionsService', () => {
  let service: CompetitionsService;
  let orderBy: ReturnType<typeof vi.fn>;
  let where: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));

    const chain = {
      from: vi.fn(),
      leftJoin: vi.fn(),
      where: vi.fn(),
      groupBy: vi.fn(),
      orderBy: vi.fn(),
    };
    for (const name of ['from', 'leftJoin', 'where', 'groupBy'] as const) {
      chain[name].mockReturnValue(chain);
    }
    orderBy = chain.orderBy;
    where = chain.where;
    const database = { db: { select: vi.fn().mockReturnValue(chain) } };
    service = new CompetitionsService(database as unknown as DatabaseService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps database rows and calculates active status', async () => {
    orderBy.mockResolvedValue([row]);

    await expect(service.findAll()).resolves.toEqual([
      { ...row, description: '', status: 'active' },
    ]);
  });

  it('calculates upcoming and finished statuses', async () => {
    orderBy.mockResolvedValue([
      {
        ...row,
        id: 1,
        startsAt: new Date('2026-11-06T11:00:00Z'),
        endsAt: new Date('2026-11-06T13:00:00Z'),
      },
      {
        ...row,
        id: 2,
        startsAt: new Date('2026-11-04T11:00:00Z'),
        endsAt: new Date('2026-11-04T13:00:00Z'),
      },
    ]);

    const result = await service.findAll();
    expect(result.map((competition) => competition.status)).toEqual([
      'upcoming',
      'finished',
    ]);
  });

  it('returns undefined for nonexistent IDs', async () => {
    orderBy.mockResolvedValue([]);

    await expect(service.findById(999)).resolves.toBeUndefined();
    expect(where).toHaveBeenCalledWith(expect.anything());
  });
});

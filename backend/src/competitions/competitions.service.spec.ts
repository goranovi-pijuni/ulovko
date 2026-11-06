import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitionsService } from './competitions.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { ArchiveService } from '../challenge-packages/archive.service.js';
import type { R2Service } from '../challenge-packages/r2.service.js';

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
    service = new CompetitionsService(
      database as unknown as DatabaseService,
      { prepare: vi.fn() } as unknown as ArchiveService,
      {
        upload: vi.fn(),
        ensureCompetitionBucket: vi.fn(),
      } as unknown as R2Service,
    );
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

describe('Competition upload validation ordering', () => {
  it('does not call R2 when archive validation fails', async () => {
    const temp = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = await temp.mkdtemp(join(tmpdir(), 'ulovko-order-test-'));
    const path = join(dir, 'test.zip');
    await temp.writeFile(path, 'bad archive');
    const categoryQuery = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
    categoryQuery.from.mockReturnValue(categoryQuery);
    categoryQuery.where.mockReturnValue(categoryQuery);
    categoryQuery.limit.mockResolvedValue([{ id: 1 }]);
    const database = { db: { select: vi.fn().mockReturnValue(categoryQuery) } };
    const archive = {
      prepare: vi.fn().mockRejectedValue(new Error('Invalid ZIP')),
    };
    const r2 = { upload: vi.fn(), ensureCompetitionBucket: vi.fn() };
    const service = new CompetitionsService(
      database as unknown as DatabaseService,
      archive as unknown as ArchiveService,
      r2 as unknown as R2Service,
    );
    vi.spyOn(service, 'findById').mockResolvedValue({
      id: 1,
      name: 'Test',
      description: '',
      organisedBy: 1,
      startsAt: new Date(),
      endsAt: new Date(),
      status: 'active',
      teamCount: 0,
    });
    try {
      await expect(
        service.uploadChallenge(1, { path } as Express.Multer.File, {
          challengeTitle: 'Test',
          publishingDate: '2026-11-05T12:00:00Z',
          flag: 'FLAG{test}',
          categoryId: '1',
        }),
      ).rejects.toThrow('Invalid ZIP');
      expect(archive.prepare).toHaveBeenCalledOnce();
      expect(r2.upload).not.toHaveBeenCalled();
    } finally {
      await temp.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('Challenge storage with existing database schema', () => {
  it('writes the challenge row only after successful R2 upload', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = await mkdtemp(join(tmpdir(), 'ulovko-r2-order-'));
    const path = join(dir, 'challenge.zip');
    await writeFile(path, 'fake zip');
    const selection = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
    selection.from.mockReturnValue(selection);
    selection.where.mockReturnValue(selection);
    selection.limit.mockResolvedValue([{ id: 1 }]);
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const database = {
      db: {
        select: vi.fn().mockReturnValue(selection),
        execute: vi.fn().mockResolvedValue({ rows: [{ id: '17' }] }),
        insert: vi.fn().mockReturnValue({ values: insertValues }),
      },
    };
    const pkg = {
      hasPublic: true,
      hasDeploy: false,
      hasConfig: false,
      cleanup: vi.fn().mockResolvedValue(undefined),
    };
    const archive = { prepare: vi.fn().mockResolvedValue(pkg) };
    const r2 = {
      upload: vi.fn().mockResolvedValue({ bucket: '001', prefix: '17/' }),
      cleanup: vi.fn(),
      ensureCompetitionBucket: vi.fn(),
    };
    const service = new CompetitionsService(
      database as unknown as DatabaseService,
      archive as unknown as ArchiveService,
      r2 as unknown as R2Service,
    );
    vi.spyOn(service, 'findById').mockResolvedValue({
      id: 1,
      name: 'Test',
      description: '',
      organisedBy: 1,
      startsAt: new Date(),
      endsAt: new Date(),
      status: 'active',
      teamCount: 0,
    });
    try {
      const result = await service.uploadChallenge(
        1,
        { path } as Express.Multer.File,
        {
          challengeTitle: 'Test',
          publishingDate: '2026-11-05T12:00:00Z',
          flag: 'FLAG{test}',
          categoryId: '1',
        },
      );
      expect(result).toMatchObject({
        id: 17,
        r2Bucket: '001',
        r2KeyPrefix: '17/',
      });
      expect(archive.prepare).toHaveBeenCalledOnce();
      expect(r2.upload).toHaveBeenCalledWith(1, 17, pkg);
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ id: 17, competitionId: 1 }),
      );
      expect(r2.upload.mock.invocationCallOrder[0]).toBeLessThan(
        insertValues.mock.invocationCallOrder[0],
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

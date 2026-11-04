import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';

import {
  ATTEMPT_WINDOW_MS,
  FlagSubmissionService,
  InMemoryFlagSubmissionRepository,
  MAX_ATTEMPTS,
} from './flag_submission.service.js';
import { FlagSubmissionModule } from './flag_submission.module.js';

const NOW = new Date('2026-11-04T12:00:00Z');
const FLAG = 'FLAG{secret}';
const CHALLENGE = 10;

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error.getStatus();
    throw error;
  }
  throw new Error('Očekivano je bačena iznimka');
}

describe('FlagSubmissionService', () => {
  let repo: InMemoryFlagSubmissionRepository;
  let service: FlagSubmissionService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);

    repo = new InMemoryFlagSubmissionRepository();
    repo.competitions.set(1, {
      id: 1,
      startsAt: new Date('2026-11-04T08:00:00Z'),
      endsAt: new Date('2026-11-05T08:00:00Z'),
    });
    repo.challenges.set(CHALLENGE, {
      id: CHALLENGE,
      competitionId: 1,
      flag: FLAG,
      publishingDate: new Date('2026-11-04T09:00:00Z'),
    });
    const since = new Date('2026-11-04T08:00:00Z');
    // Tim 1: korisnici 1, 2 i 4..8; tim 2: korisnik 3.
    for (const userId of [1, 2, 4, 5, 6, 7, 8]) {
      repo.memberships.push({
        userId,
        teamId: 1,
        competitionId: 1,
        startsAt: since,
      });
    }
    repo.memberships.push({
      userId: 3,
      teamId: 2,
      competitionId: 1,
      startsAt: since,
    });

    service = new FlagSubmissionService(repo);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('provjera zastavice', () => {
    it('prihvaća točnu zastavicu i evidentira rješenje', async () => {
      await expect(service.submit(1, CHALLENGE, FLAG)).resolves.toEqual({
        status: 'correct',
        challengeId: CHALLENGE,
      });
      expect(repo.solutions).toEqual([
        {
          userId: 1,
          teamId: 1,
          competitionId: 1,
          challengeId: CHALLENGE,
          solveTime: NOW,
        },
      ]);
    });

    it('pogrešnu zastavicu ne evidentira', async () => {
      await expect(
        service.submit(1, CHALLENGE, 'FLAG{wrong}'),
      ).resolves.toEqual({
        status: 'incorrect',
        challengeId: CHALLENGE,
      });
      expect(repo.solutions).toHaveLength(0);
    });

    it('ignorira razmake oko zastavice, ali razlikuje velika i mala slova', async () => {
      await expect(
        service.submit(1, CHALLENGE, `  ${FLAG}\n`),
      ).resolves.toMatchObject({
        status: 'correct',
      });
      await expect(
        service.submit(3, CHALLENGE, FLAG.toLowerCase()),
      ).resolves.toMatchObject({ status: 'incorrect' });
    });
  });

  describe('bodovanje po timu (F-011)', () => {
    it('ponovljena točna predaja istog tima ne stvara novo rješenje', async () => {
      await service.submit(1, CHALLENGE, FLAG);

      // Isti korisnik i drugi član istog tima.
      await expect(service.submit(1, CHALLENGE, FLAG)).resolves.toMatchObject({
        status: 'already_solved',
      });
      await expect(service.submit(2, CHALLENGE, FLAG)).resolves.toMatchObject({
        status: 'already_solved',
      });
      expect(repo.solutions).toHaveLength(1);
    });

    it('drugi tim i dalje može riješiti zadatak', async () => {
      await service.submit(1, CHALLENGE, FLAG);

      await expect(service.submit(3, CHALLENGE, FLAG)).resolves.toMatchObject({
        status: 'correct',
      });
      expect(repo.solutions.map((s) => s.teamId)).toEqual([1, 2]);
    });

    it('istodobne predaje članova istog tima daju točno jedno rješenje (NF-06)', async () => {
      const members = [1, 2, 4, 5, 6].slice(0, MAX_ATTEMPTS);

      const results = await Promise.all(
        members.map((userId) => service.submit(userId, CHALLENGE, FLAG)),
      );

      expect(results.filter((r) => r.status === 'correct')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'already_solved')).toHaveLength(
        members.length - 1,
      );
      expect(repo.solutions).toHaveLength(1);
    });
  });

  describe('pravila natjecanja', () => {
    it('za nepostojeći zadatak vraća 404', async () => {
      await expect(service.submit(1, 999, FLAG)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('za neobjavljen zadatak vraća 404 kao da ne postoji (F-010)', async () => {
      repo.challenges.get(CHALLENGE)!.publishingDate = new Date(
        '2026-11-04T13:00:00Z',
      );

      await expect(service.submit(1, CHALLENGE, FLAG)).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([
      ['prije početka', '2026-11-04T12:30:00Z', '2026-11-05T08:00:00Z'],
      ['nakon završetka', '2026-11-04T08:00:00Z', '2026-11-04T11:59:59Z'],
    ])('odbija predaju %s natjecanja', async (_label, startsAt, endsAt) => {
      repo.competitions.set(1, {
        id: 1,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
      });

      await expect(service.submit(1, CHALLENGE, FLAG)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.solutions).toHaveLength(0);
    });

    it('odbija korisnika koji nije član tima u natjecanju', async () => {
      await expect(service.submit(99, CHALLENGE, FLAG)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('odbija korisnika kojem je članstvo u timu isteklo', async () => {
      repo.memberships.find((m) => m.userId === 1)!.endsAt = new Date(
        '2026-11-04T11:00:00Z',
      );

      await expect(service.submit(1, CHALLENGE, FLAG)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('ograničenje pokušaja', () => {
    async function failTimes(userId: number, times: number) {
      for (let i = 0; i < times; i++) {
        await service.submit(userId, CHALLENGE, `FLAG{pogresna_${i}}`);
      }
    }

    it(`nakon ${MAX_ATTEMPTS} pokušaja vraća 429, čak i za točnu zastavicu`, async () => {
      await failTimes(1, MAX_ATTEMPTS);

      expect(await statusOf(service.submit(1, CHALLENGE, FLAG))).toBe(429);
      expect(repo.solutions).toHaveLength(0);
    });

    it('ograničenje vrijedi za cijeli tim, a ne samo za jednog korisnika', async () => {
      await failTimes(1, MAX_ATTEMPTS);

      expect(await statusOf(service.submit(2, CHALLENGE, FLAG))).toBe(429);
    });

    it('ne utječe na druge timove', async () => {
      await failTimes(1, MAX_ATTEMPTS);

      await expect(service.submit(3, CHALLENGE, FLAG)).resolves.toMatchObject({
        status: 'correct',
      });
    });

    it('ponovno dopušta pokušaje nakon isteka prozora', async () => {
      await failTimes(1, MAX_ATTEMPTS);

      vi.setSystemTime(new Date(NOW.getTime() + ATTEMPT_WINDOW_MS + 1));

      await expect(service.submit(1, CHALLENGE, FLAG)).resolves.toMatchObject({
        status: 'correct',
      });
    });

    it('već riješen zadatak ne troši pokušaje', async () => {
      await service.submit(1, CHALLENGE, FLAG);

      for (let i = 0; i < MAX_ATTEMPTS * 2; i++) {
        await expect(service.submit(2, CHALLENGE, 'x')).resolves.toMatchObject({
          status: 'already_solved',
        });
      }
    });
  });

  describe('povezivanje modula', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('uz FLAG_SUBMISSION_DEV=1 koristi demo podatke', async () => {
      vi.stubEnv('FLAG_SUBMISSION_DEV', '1');
      const moduleRef = await Test.createTestingModule({
        imports: [FlagSubmissionModule],
      }).compile();
      const wired = moduleRef.get(FlagSubmissionService);

      await expect(
        wired.submit(1, 1, 'FLAG{ulovko_demo}'),
      ).resolves.toMatchObject({
        status: 'correct',
      });
      await expect(
        wired.submit(2, 1, 'FLAG{ulovko_demo}'),
      ).resolves.toMatchObject({
        status: 'already_solved',
      });
      await expect(wired.submit(3, 1, 'FLAG{krivo}')).resolves.toMatchObject({
        status: 'incorrect',
      });
    });

    it('bez FLAG_SUBMISSION_DEV nema demo podataka', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [FlagSubmissionModule],
      }).compile();
      const wired = moduleRef.get(FlagSubmissionService);

      await expect(wired.submit(1, 1, 'FLAG{ulovko_demo}')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

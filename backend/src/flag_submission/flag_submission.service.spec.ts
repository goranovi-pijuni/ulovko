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
  MAX_ATTEMPTS,
} from './flag_submission.service.js';
import {
  DatabaseFlagSubmissionRepository,
  FlagSubmissionRepository,
} from './flag_submission.repository.js';
import { FlagSubmissionModule } from './flag_submission.module.js';

const NOW = new Date('2026-11-04T12:00:00Z');
const FLAG = 'FLAG{secret}';
const CHALLENGE = 10;

const TEAM_OF: Record<number, number> = { 1: 1, 2: 1, 3: 2 };

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
  const repo = {
    findChallenge: vi.fn(),
    findCompetition: vi.fn(),
    findTeamId: vi.fn(),
    hasTeamSolved: vi.fn(),
    recordSolution: vi.fn(),
  };
  let service: FlagSubmissionService;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.resetAllMocks();

    repo.findChallenge.mockResolvedValue({
      id: CHALLENGE,
      competitionId: 1,
      flag: FLAG,
      publishingDate: new Date('2026-11-04T09:00:00Z'),
    });
    repo.findCompetition.mockResolvedValue({
      id: 1,
      startsAt: new Date('2026-11-04T08:00:00Z'),
      endsAt: new Date('2026-11-05T08:00:00Z'),
    });
    repo.findTeamId.mockImplementation(
      async (userId: number) => TEAM_OF[userId],
    );
    repo.hasTeamSolved.mockResolvedValue(false);
    repo.recordSolution.mockResolvedValue(true);

    service = new FlagSubmissionService(
      repo as unknown as FlagSubmissionRepository,
    );
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
      expect(repo.recordSolution).toHaveBeenCalledWith({
        userId: 1,
        teamId: 1,
        competitionId: 1,
        challengeId: CHALLENGE,
        solveTime: NOW,
      });
    });

    it('pogrešnu zastavicu ne evidentira', async () => {
      await expect(
        service.submit(1, CHALLENGE, 'FLAG{wrong}'),
      ).resolves.toEqual({
        status: 'incorrect',
        challengeId: CHALLENGE,
      });
      expect(repo.recordSolution).not.toHaveBeenCalled();
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
    it('provjerava rješenje za tim korisnika u natjecanju zadatka', async () => {
      await service.submit(3, CHALLENGE, FLAG);

      expect(repo.findTeamId).toHaveBeenCalledWith(3, 1, NOW);
      expect(repo.hasTeamSolved).toHaveBeenCalledWith(2, CHALLENGE);
    });

    it('ako je tim već riješio zadatak, vraća already_solved bez provjere zastavice', async () => {
      repo.hasTeamSolved.mockResolvedValue(true);

      await expect(service.submit(2, CHALLENGE, FLAG)).resolves.toMatchObject({
        status: 'already_solved',
      });
      await expect(
        service.submit(2, CHALLENGE, 'FLAG{wrong}'),
      ).resolves.toMatchObject({ status: 'already_solved' });
      expect(repo.recordSolution).not.toHaveBeenCalled();
    });

    it('ako rješenje nije evidentirano jer je istodobno stiglo drugo, vraća already_solved', async () => {
      repo.recordSolution.mockResolvedValue(false);

      await expect(service.submit(1, CHALLENGE, FLAG)).resolves.toEqual({
        status: 'already_solved',
        challengeId: CHALLENGE,
      });
    });
  });

  describe('pravila natjecanja', () => {
    it('za nepostojeći zadatak vraća 404', async () => {
      repo.findChallenge.mockResolvedValue(undefined);

      await expect(service.submit(1, 999, FLAG)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('za neobjavljen zadatak vraća 404 kao da ne postoji (F-010)', async () => {
      repo.findChallenge.mockResolvedValue({
        id: CHALLENGE,
        competitionId: 1,
        flag: FLAG,
        publishingDate: new Date('2026-11-04T13:00:00Z'),
      });

      await expect(service.submit(1, CHALLENGE, FLAG)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findCompetition).not.toHaveBeenCalled();
    });

    it('za zadatak čije natjecanje ne postoji vraća 404', async () => {
      repo.findCompetition.mockResolvedValue(undefined);

      await expect(service.submit(1, CHALLENGE, FLAG)).rejects.toThrow(
        NotFoundException,
      );
    });

    it.each([
      ['prije početka', '2026-11-04T12:30:00Z', '2026-11-05T08:00:00Z'],
      ['nakon završetka', '2026-11-04T08:00:00Z', '2026-11-04T11:59:59Z'],
    ])('odbija predaju %s natjecanja', async (_label, startsAt, endsAt) => {
      repo.findCompetition.mockResolvedValue({
        id: 1,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
      });

      await expect(service.submit(1, CHALLENGE, FLAG)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.recordSolution).not.toHaveBeenCalled();
    });

    it('odbija korisnika koji nije član tima u natjecanju', async () => {
      await expect(service.submit(99, CHALLENGE, FLAG)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.hasTeamSolved).not.toHaveBeenCalled();
      expect(repo.recordSolution).not.toHaveBeenCalled();
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
      expect(repo.recordSolution).not.toHaveBeenCalled();
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
      repo.hasTeamSolved.mockResolvedValue(true);
      for (let i = 0; i < MAX_ATTEMPTS * 2; i++) {
        await service.submit(2, CHALLENGE, 'x');
      }
      repo.hasTeamSolved.mockResolvedValue(false);

      await expect(service.submit(2, CHALLENGE, FLAG)).resolves.toMatchObject({
        status: 'correct',
      });
    });
  });

  describe('povezivanje modula', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('koristi repozitorij nad bazom podataka', async () => {
      vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
      vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
      vi.stubEnv('GOOGLE_CALLBACK_URL', 'http://localhost/callback');
      const moduleRef = await Test.createTestingModule({
        imports: [FlagSubmissionModule],
      }).compile();

      expect(moduleRef.get(FlagSubmissionRepository)).toBeInstanceOf(
        DatabaseFlagSubmissionRepository,
      );
    });
  });
});

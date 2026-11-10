import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  FlagSubmissionController,
  MAX_FLAG_LENGTH,
} from './flag_submission.controller.js';
import { FlagSubmissionService } from './flag_submission.service.js';

describe('FlagSubmissionController', () => {
  let app: INestApplication;
  const mockService = { submit: vi.fn() };

  async function createApp(sessionUserId?: number) {
    const moduleRef = await Test.createTestingModule({
      controllers: [FlagSubmissionController],
      providers: [{ provide: FlagSubmissionService, useValue: mockService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    if (sessionUserId !== undefined) {
      app.use((req: any, _res: unknown, next: () => void) => {
        req.user = { id: sessionUserId };
        req.isAuthenticated = () => true;
        next();
      });
    }
    await app.init();
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockService.submit.mockResolvedValue({
      status: 'correct',
      challengeId: 10,
    });
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app.close();
  });

  describe('identitet', () => {
    it('bez prijave vraća 401 i ne poziva servis', async () => {
      await createApp();

      await request(app.getHttpServer())
        .post('/api/flag-submission')
        .send({ challengeId: 10, flag: 'FLAG{x}' })
        .expect(401);
      expect(mockService.submit).not.toHaveBeenCalled();
    });

    it('zaglavlje X-User-Id se ignorira čak i uz FLAG_SUBMISSION_DEV=1', async () => {
      vi.stubEnv('FLAG_SUBMISSION_DEV', '1');
      await createApp();

      await request(app.getHttpServer())
        .post('/api/flag-submission')
        .set('X-User-Id', '7')
        .send({ challengeId: 10, flag: 'FLAG{x}' })
        .expect(401);
      expect(mockService.submit).not.toHaveBeenCalled();
    });

    it('koristi korisnika iz sesije i ignorira userId iz tijela zahtjeva', async () => {
      await createApp(5);

      await request(app.getHttpServer())
        .post('/api/flag-submission')
        .send({ challengeId: 10, flag: 'FLAG{x}', userId: 999 })
        .expect(200);
      expect(mockService.submit).toHaveBeenCalledWith(5, 10, 'FLAG{x}');
    });
  });

  describe('predaja', () => {
    it.each(['correct', 'incorrect', 'already_solved'])(
      'vraća 200 i rezultat servisa (%s)',
      async (status) => {
        mockService.submit.mockResolvedValue({ status, challengeId: 10 });
        await createApp(5);

        const response = await request(app.getHttpServer())
          .post('/api/flag-submission')
          .send({ challengeId: 10, flag: 'FLAG{x}' })
          .expect(200)
          .expect('Content-Type', /json/);

        expect(response.body).toEqual({ status, challengeId: 10 });
      },
    );
  });

  describe('validacija tijela zahtjeva', () => {
    it.each([
      ['bez tijela', undefined],
      ['bez challengeId', { flag: 'FLAG{x}' }],
      ['challengeId kao tekst', { challengeId: '10', flag: 'FLAG{x}' }],
      ['challengeId nula', { challengeId: 0, flag: 'FLAG{x}' }],
      ['challengeId negativan', { challengeId: -1, flag: 'FLAG{x}' }],
      ['challengeId decimalan', { challengeId: 1.5, flag: 'FLAG{x}' }],
      ['bez flag', { challengeId: 10 }],
      ['flag kao broj', { challengeId: 10, flag: 123 }],
      ['flag prazan', { challengeId: 10, flag: '' }],
      ['flag samo razmaci', { challengeId: 10, flag: '   ' }],
      [
        'flag predug',
        { challengeId: 10, flag: 'a'.repeat(MAX_FLAG_LENGTH + 1) },
      ],
    ])('vraća 400: %s', async (_label, body) => {
      await createApp(5);

      await request(app.getHttpServer())
        .post('/api/flag-submission')
        .send(body)
        .expect(400);
      expect(mockService.submit).not.toHaveBeenCalled();
    });

    it('prihvaća zastavicu najveće dopuštene duljine', async () => {
      await createApp(5);

      await request(app.getHttpServer())
        .post('/api/flag-submission')
        .send({ challengeId: 10, flag: 'a'.repeat(MAX_FLAG_LENGTH) })
        .expect(200);
    });
  });
});

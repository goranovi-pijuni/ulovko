import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { CompetitionsController } from '../src/competitions/competitions.controller.js';
import { CompetitionsService } from '../src/competitions/competitions.service.js';
import { CompetitionOwnerGuard } from '../src/competitions/guards/competition-owner.guard.js';
import { DatabaseService } from '../src/database/database.service.js';
import { AuthenticatedGuard } from '../src/auth/guards/authenticated.guard.js';
import { RoleGuard } from '../src/roles/role.guard.js';
import { Role } from '../src/roles/roles.enum.js';

// Exercise real Nest guards and request validation without Google, PostgreSQL,
// or R2 credentials. The request header simulates Passport's rehydrated user.
describe('Competitions API authorization', () => {
  let app: INestApplication;
  let existingOwner: number | null = 7;
  const createCompetition = vi.fn();
  const uploadChallenge = vi.fn();
  const service = {
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue({ id: 1 }),
    listChallenges: vi.fn().mockResolvedValue([]),
    createCompetition,
    uploadChallenge,
  };
  const selectChain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };

  beforeAll(async () => {
    selectChain.from.mockReturnValue(selectChain);
    selectChain.where.mockReturnValue(selectChain);
    selectChain.limit.mockImplementation(async () =>
      existingOwner === null ? [] : [{ organizedBy: existingOwner }],
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [CompetitionsController],
      providers: [
        { provide: CompetitionsService, useValue: service },
        {
          provide: DatabaseService,
          useValue: { db: { select: vi.fn().mockReturnValue(selectChain) } },
        },
        Reflector,
        AuthenticatedGuard,
        RoleGuard,
        CompetitionOwnerGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const role = req.headers['x-test-role'];
      const users: Record<string, { id: number; permLevel: Role }> = {
        user: { id: 7, permLevel: Role.USER },
        organizer: { id: 7, permLevel: Role.ORGANIZER },
        admin: { id: 9, permLevel: Role.ADMIN },
      };
      const testUser = typeof role === 'string' ? users[role] : undefined;
      req.user = testUser as Express.User | undefined;
      req.isAuthenticated = () => Boolean(req.user);
      next();
    });
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    existingOwner = 7;
    createCompetition.mockResolvedValue({ id: 1, name: 'CTF', organisedBy: 7 });
    uploadChallenge.mockResolvedValue({ id: 5 });
  });

  afterAll(async () => {
    await app?.close();
  });

  const validCompetition = {
    name: 'CTF',
    startsAt: '2026-12-01T10:00:00Z',
    endsAt: '2026-12-02T10:00:00Z',
  };

  it('keeps competition and challenge reading public', async () => {
    await request(app.getHttpServer()).get('/api/competitions').expect(200);
    await request(app.getHttpServer()).get('/api/competitions/1').expect(200);
    await request(app.getHttpServer())
      .get('/api/competitions/1/challenges')
      .expect(200);
  });

  it('returns 400 for invalid competition IDs', async () => {
    await request(app.getHttpServer()).get('/api/competitions/abc').expect(400);
  });

  it('rejects unauthenticated and normal users creating competitions', async () => {
    await request(app.getHttpServer())
      .post('/api/competitions')
      .send(validCompetition)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/competitions')
      .set('x-test-role', 'user')
      .send(validCompetition)
      .expect(403);
    expect(createCompetition).not.toHaveBeenCalled();
  });

  it.each(['organizer', 'admin'])(
    'allows %s to create using the session user ID',
    async (role) => {
      await request(app.getHttpServer())
        .post('/api/competitions')
        .set('x-test-role', role)
        .send(validCompetition)
        .expect(201);
      expect(createCompetition).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'CTF' }),
        role === 'admin' ? 9 : 7,
      );
    },
  );

  it('rejects client-supplied owner IDs and invalid payloads', async () => {
    await request(app.getHttpServer())
      .post('/api/competitions')
      .set('x-test-role', 'organizer')
      .send({ ...validCompetition, organisedBy: 999 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/competitions')
      .set('x-test-role', 'organizer')
      .send({ ...validCompetition, startsAt: 'not a date' })
      .expect(400);
    expect(createCompetition).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated and normal users uploading challenges before Multer', async () => {
    await request(app.getHttpServer())
      .post('/api/competitions/1/challenges')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/competitions/1/challenges')
      .set('x-test-role', 'user')
      .expect(403);
    expect(uploadChallenge).not.toHaveBeenCalled();
  });

  it('allows the competition owner to upload and forbids other organizers', async () => {
    await request(app.getHttpServer())
      .post('/api/competitions/1/challenges')
      .set('x-test-role', 'organizer')
      .expect(201);
    expect(uploadChallenge).toHaveBeenCalledOnce();
    existingOwner = 99;
    await request(app.getHttpServer())
      .post('/api/competitions/1/challenges')
      .set('x-test-role', 'organizer')
      .expect(403);
  });

  it("allows admins to upload to another owner's competition", async () => {
    existingOwner = 99;
    await request(app.getHttpServer())
      .post('/api/competitions/1/challenges')
      .set('x-test-role', 'admin')
      .expect(201);
    expect(uploadChallenge).toHaveBeenCalledOnce();
  });

  it('distinguishes missing and invalid competitions for authenticated upload', async () => {
    existingOwner = null;
    await request(app.getHttpServer())
      .post('/api/competitions/1/challenges')
      .set('x-test-role', 'admin')
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/competitions/abc/challenges')
      .set('x-test-role', 'admin')
      .expect(400);
    expect(uploadChallenge).not.toHaveBeenCalled();
  });
});

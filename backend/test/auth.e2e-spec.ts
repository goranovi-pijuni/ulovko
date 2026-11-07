
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthenticatedGuard } from '../src/auth/guards/authenticated.guard.js';
import { GoogleAuthGuard } from '../src/auth/guards/google-auth.guard.js';
import { RoleGuard } from '../src/roles/role.guard.js';
import { Reflector } from '@nestjs/core';
import { Role } from '../src/roles/roles.enum.js';
import request from 'supertest';
import { Request, Response, NextFunction } from 'express';

type TestRequest = Request & {
    user?: any;
    isAuthenticated: () => this is Request & { user: any };
};

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  let currentUser: any = null;

  const mockRequest = {
    isAuthenticated: () => currentUser !== null,
    get user() {
      return currentUser;
    },
    logout: (callback: (err?: Error) => void) => callback(),
    session: {
      destroy: (callback: (err?: Error) => void) => callback(),
    },
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        Reflector,
        RoleGuard,
        AuthenticatedGuard,
      ],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({
        canActivate: (context: any) => {
          if (!context.switchToHttp().getRequest().isAuthenticated()) {
            const { UnauthorizedException } = require('@nestjs/common');
            throw new UnauthorizedException();
          }
          return true;
        },
      })
      .overrideGuard(RoleGuard)
      .useValue({
        canActivate: (context: any) => {
          const requiredRoles = new Reflector().getAllAndOverride(
            'roles',
            [context.getHandler(), context.getClass()],
          );

          if (!requiredRoles?.length) return true;

          const user = context.switchToHttp().getRequest().user;

          if (!user) {
            const { UnauthorizedException } = require('@nestjs/common');
            throw new UnauthorizedException();
          }

          if (!requiredRoles.includes(user.permLevel)) {
            const { ForbiddenException } = require('@nestjs/common');
            throw new ForbiddenException();
          }

          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();

    app.setGlobalPrefix('api');

    app.use((req: Request, res: Response, next: NextFunction) => {
      const testReq = req as TestRequest;

      Object.defineProperty(req, 'user', {
        get: () => currentUser,
      });

      req.isAuthenticated = function(
        this: TestRequest,
      ): this is Request & { user: any } {
        return currentUser !== null;
      };

      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    currentUser = null;
  });

  it('should reject unauthenticated users from profile', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/profile')
      .expect(401);
  });

  it('should reject unauthenticated users from organizer endpoint', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/organizer')
      .expect(401);
  });

  it('should reject regular users from organizer endpoint', async () => {
    currentUser = {
      id: 1,
      email: 'user@gmail.com',
      permLevel: Role.USER,
    };

    await request(app.getHttpServer())
      .get('/api/auth/organizer')
      .expect(403);
  });

  it('should allow organizers to access organizer endpoint', async () => {
    currentUser = {
      id: 2,
      email: 'organizer@gmail.com',
      permLevel: Role.ORGANIZER,
    };

    await request(app.getHttpServer())
      .get('/api/auth/organizer')
      .expect(200)
      .expect({
        msg: 'Welcome, organizer!',
      });
  });

  it('should reject organizers from admin endpoint', async () => {
    currentUser = {
      id: 2,
      email: 'organizer@gmail.com',
      permLevel: Role.ORGANIZER,
    };

    await request(app.getHttpServer())
      .get('/api/auth/admin')
      .expect(403);
  });

  it('should allow admins to access admin endpoint', async () => {
    currentUser = {
      id: 3,
      email: 'admin@gmail.com',
      permLevel: Role.ADMIN,
    };

    await request(app.getHttpServer())
      .get('/api/auth/admin')
      .expect(200)
      .expect({
        msg: 'Welcome, admin!',
      });
  });

  it('should return authenticated user profile', async () => {
    currentUser = {
      id: 1,
      email: 'user@gmail.com',
      permLevel: Role.USER,
    };

    await request(app.getHttpServer())
      .get('/api/auth/profile')
      .expect(200)
      .expect({
        id: 1,
        email: 'user@gmail.com',
        permLevel: Role.USER,
      });
  });
});

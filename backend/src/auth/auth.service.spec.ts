import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { Role } from '../roles/roles.enum.js';

describe('AuthService', () => {
  let service: AuthService;

  const existingUser = {
    id: 1,
    email: 'test@gmail.com',
    displayName: 'Test User',
    oauthUserId: 'google-123',
    avatar: null,
    permLevel: Role.USER,
    creationTime: new Date(),
    lastEditTime: new Date(),
  };

  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));

  const database = {
    db: {
      select,
      insert,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(database as any);
  });

  it('should return existing user', async () => {
    limit.mockResolvedValue([existingUser]);

    const result = await service.validateUser({
      email: 'test@gmail.com',
      emailVerified: true,
      displayName: 'Test User',
      oauthUserId: 'google-123',
      creationTime: new Date(),
      lastEditTime: new Date(),
    });

    expect(result).toEqual(existingUser);
    expect(insert).not.toHaveBeenCalled();
  });

  it('should create a new user', async () => {
    limit.mockResolvedValue([]);

    const newUser = {
      ...existingUser,
      id: 2,
      oauthUserId: 'google-456',
      email: 'new@gmail.com',
    };

    returning.mockResolvedValue([newUser]);

    const result = await service.validateUser({
      email: 'new@gmail.com',
      emailVerified: true,
      displayName: 'New User',
      oauthUserId: 'google-456',
      creationTime: new Date(),
      lastEditTime: new Date(),
    });

    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ avatar: null }),
    );
    expect(result).toEqual(newUser);
    expect(result.permLevel).toBe(Role.USER);
  });

  it('should reject users with unverified email', async () => {
    limit.mockResolvedValue([]);

    await expect(
      service.validateUser({
        email: 'unverified@gmail.com',
        emailVerified: false,
        displayName: 'Unverified User',
        oauthUserId: 'google-789',
        creationTime: new Date(),
        lastEditTime: new Date(),
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(insert).not.toHaveBeenCalled();
  });
});

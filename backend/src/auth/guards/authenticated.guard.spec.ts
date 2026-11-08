import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthenticatedGuard } from './authenticated.guard.js';

describe('AuthenticatedGuard', () => {
  const guard = new AuthenticatedGuard();

  const createContext = (authenticated: boolean, hasUser = authenticated) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          isAuthenticated: vi.fn(() => authenticated),
          user: hasUser ? { id: 1 } : undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow authenticated users', async () => {
    const result = await guard.canActivate(createContext(true));

    expect(result).toBe(true);
  });

  it('should reject unauthenticated users', async () => {
    await expect(guard.canActivate(createContext(false))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should reject a session without a rehydrated PostgreSQL user', async () => {
    await expect(guard.canActivate(createContext(true, false))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should return the correct error message', async () => {
    await expect(guard.canActivate(createContext(false))).rejects.toThrow(
      'You must be logged in.',
    );
  });
});

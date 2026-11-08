import { describe, it, expect, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthenticatedGuard } from './authenticated.guard.js';

describe('AuthenticatedGuard', () => {
  const guard = new AuthenticatedGuard();

  const createContext = (authenticated: boolean) => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          isAuthenticated: vi.fn(() => authenticated),
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

  it('should return the correct error message', async () => {
    await expect(guard.canActivate(createContext(false))).rejects.toThrow(
      'You must be logged in.',
    );
  });
});

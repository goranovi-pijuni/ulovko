
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RoleGuard } from './role.guard.js';
import { Role } from './roles.enum.js';
import { ROLES_KEY } from './roles.decorator.js';

describe('RoleGuard', () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  };

  let guard: RoleGuard;

  const createContext = (permLevel?: Role): ExecutionContext => {
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: permLevel === undefined ? undefined : { permLevel },
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new RoleGuard(reflector as unknown as Reflector);
  });

  it('should allow access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = guard.canActivate(createContext());

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      ROLES_KEY,
      expect.any(Array),
    );
  });

  it('should reject unauthenticated users', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORGANIZER]);

    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('should allow USER to access USER endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.USER]);

    expect(
      guard.canActivate(createContext(Role.USER)),
    ).toBe(true);
  });

  it('should reject USER from ORGANIZER endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORGANIZER]);

    expect(() => guard.canActivate(createContext(Role.USER)))
      .toThrow(ForbiddenException);
  });

  it('should allow ORGANIZER to access ORGANIZER endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORGANIZER]);

    expect(
      guard.canActivate(createContext(Role.ORGANIZER)),
    ).toBe(true);
  });

  it('should reject ORGANIZER from ADMIN endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(() => guard.canActivate(createContext(Role.ORGANIZER)))
      .toThrow(ForbiddenException);
  });

  it('should allow ADMIN to access ADMIN endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    expect(
      guard.canActivate(createContext(Role.ADMIN)),
    ).toBe(true);
  });

  it('should allow ADMIN to access ORGANIZER endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ORGANIZER, Role.ADMIN]);

    expect(
      guard.canActivate(createContext(Role.ADMIN)),
    ).toBe(true);
  });
});

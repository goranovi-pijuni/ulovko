import { describe, expect, it, vi } from 'vitest';
import { SessionSerializer } from './auth.serializer.js';
import type { AuthService } from './auth.service.js';
import type { User } from '../users/interfaces/user.interface.js';

describe('SessionSerializer', () => {
  const user: User = {
    id: 42,
    email: 'test@example.org',
    displayName: 'Test',
    oauthUserId: 'google-42',
    avatar: null,
    permLevel: 1,
    creationTime: new Date(),
    lastEditTime: new Date(),
  };

  it('stores only the user ID in the session', () => {
    const serializer = new SessionSerializer({} as AuthService);
    const done = vi.fn();
    serializer.serializeUser(user, done);
    expect(done).toHaveBeenCalledWith(null, 42);
  });

  it('loads the current user from the database', async () => {
    const findUser = vi.fn().mockResolvedValue(user);
    const serializer = new SessionSerializer({
      findUser,
    } as unknown as AuthService);
    const done = vi.fn();
    await serializer.deserializeUser(42, done);
    expect(findUser).toHaveBeenCalledWith(42);
    expect(done).toHaveBeenCalledWith(null, user);
  });

  it('rejects a session for a removed user', async () => {
    const serializer = new SessionSerializer({
      findUser: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService);
    const done = vi.fn();
    await serializer.deserializeUser(42, done);
    expect(done).toHaveBeenCalledWith(null, false);
  });
});

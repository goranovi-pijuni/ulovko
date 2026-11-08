import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import type { User } from '../users/interfaces/user.interface.js';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly authService: AuthService) {
    super();
  }

  serializeUser(user: User, done: (err: Error | null, id?: number) => void) {
    // Store the ID rather than a potentially stale user record in the session.
    done(null, user.id);
  }

  async deserializeUser(
    id: number,
    done: (err: Error | null, user?: User | false) => void,
  ) {
    try {
      const user = await this.authService.findUser(id);
      done(null, user ?? false);
    } catch (error) {
      done(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

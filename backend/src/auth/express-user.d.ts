import type { User as UlovkoUser } from '../users/interfaces/user.interface.js';

// Passport's req.user is always the user reloaded from PostgreSQL by
// SessionSerializer, not the raw Google profile or a client-supplied ID.
declare global {
  namespace Express {
    interface User extends UlovkoUser {}
  }
}

export {};

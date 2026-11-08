import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '../users/interfaces/user.interface.js';
import { Role } from '../roles/roles.enum.js';
import { DatabaseService } from '../database/database.service.js';
import { users } from '../database/schema.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async findUserByOauthUserId(oauthUserId: string) {
    const [user] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        oauthUserId: users.oauthUserId,
        avatar: users.avatar,
        permLevel: users.permLevel,
        creationTime: users.creationTime,
        lastEditTime: users.lastEditTime,
      })
      .from(users)
      .where(eq(users.oauthUserId, oauthUserId))
      .limit(1);

    return user;
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const [created] = await this.database.db
      .insert(users)
      .values({
        email: user.email,
        displayName: user.displayName,
        oauthUserId: user.oauthUserId,
        avatar: user.avatar,
        permLevel: user.permLevel,
        creationTime: user.creationTime,
        lastEditTime: user.lastEditTime,
      })
      .returning();

    return created;
  }

  async findUser(id: number): Promise<User | undefined> {
    const [user] = await this.database.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        oauthUserId: users.oauthUserId,
        avatar: users.avatar,
        permLevel: users.permLevel,
        creationTime: users.creationTime,
        lastEditTime: users.lastEditTime,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user;
  }

  async validateUser(profile: {
    email: string;
    emailVerified: boolean;
    displayName: string;
    oauthUserId: string;
    creationTime: Date;
    lastEditTime: Date;
  }) {
    if (!profile.email || !profile.emailVerified) {
      throw new UnauthorizedException(
        'Google email is missing or not verified.',
      );
    }

    const existingUser = await this.findUserByOauthUserId(profile.oauthUserId);
    if (existingUser) {
      return existingUser;
    }

    const newUser = await this.createUser({
      email: profile.email,
      displayName: profile.displayName,
      oauthUserId: profile.oauthUserId,
      // Keep the database bytea column; do not store Google picture URLs.
      avatar: null,
      permLevel: Role.USER,
      creationTime: profile.creationTime,
      lastEditTime: profile.lastEditTime,
    });

    return newUser;
  }
}

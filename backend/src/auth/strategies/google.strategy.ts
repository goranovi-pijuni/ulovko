import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import { AuthService } from '../auth.service.js';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['openid', 'profile', 'email'],
      // Validate that the Google callback belongs to an initiated login.
      state: true,
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const now = new Date();

    return this.authService.validateUser({
      email: profile.emails?.[0]?.value ?? '',
      // passport-google-oauth20 may expose email_verified as the string 'true'.
      emailVerified: String(profile._json.email_verified) === 'true',
      displayName: profile.displayName || profile.emails?.[0]?.value || 'User',
      oauthUserId: profile.id,
      // Avatar remains PostgreSQL bytea, and is not imported from Google.
      creationTime: now,
      lastEditTime: now,
    });
  }
}

import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from 'passport-google-oauth20';
import { AuthService } from "../auth.service.js";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy){
    constructor (
        private readonly authService: AuthService
    ) {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            callbackURL: process.env.GOOGLE_CALLBACK_URL!,
            scope: ['openid', 'profile', 'email']
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: Profile){
        const now = new Date();

        const user = await this.authService.validateUser({
            email: profile.emails?.[0]?.value!,
            emailVerified: profile._json.email_verified === true,
            displayName: profile.displayName,
            oauthUserId: profile.id,
            avatar: profile.photos?.[0]?.value!,
            creationTime: now,
            lastEditTime: now
        });
        
        return user || null;
    }
}
import { Inject, Injectable } from "@nestjs/common";
import { PassportSerializer } from "@nestjs/passport";
import { AuthService } from "./auth.service.js";
import { User } from "../users/interfaces/user.interface.js";

@Injectable()
export class SessionSerializer extends PassportSerializer {
    constructor (
        private readonly authService: AuthService,
    ) {
        super();
    }

    serializeUser(user: User, done: Function) {
        done(null, user);
    }

    async deserializeUser(payload: any, done: Function) {
        const user = await this.authService.findUser(payload.id);
        return user ? done(null, user) : done(null, null);
    }
}
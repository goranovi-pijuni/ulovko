import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '../users/interfaces/user.interface.js';
import { USERS_REPOSITORY } from '../users/users.repository.js';
import type { UsersRepository } from '../users/users.repository.js';
import { Role } from '../roles/roles.enum.js';

@Injectable()
export class AuthService {
    constructor(
        @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository 
    ) {}

    async validateUser(profile: {
        oAuthUserId: string;
        email: string;
        displayName: string;
        avatar: string,
        emailVerified: boolean;
    }): Promise<User> {
        let user = await this.usersRepository.findByOAuthUserId(profile.oAuthUserId);

        if (user) {
            return user;
        }

        if (!profile.emailVerified) {
            throw new UnauthorizedException('Google email is not verified.');
        }

        user = await this.usersRepository.create({
            oAuthUserId: profile.oAuthUserId,
            email: profile.email,
            displayName: profile.displayName,
            avatar: profile.avatar,
            permLevel: Role.USER,
        });

        return user;
    }

    async findUser(id: number) {
        const user = await this.usersRepository.findById(id);
        return user;
    }
}

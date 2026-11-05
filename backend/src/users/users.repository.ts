import { User } from "./interfaces/user.interface.js";

export const USERS_REPOSITORY = 'USERS_REPOSITORY'

export interface UsersRepository {
    findByOAuthUserId(oAuthUserId: string): Promise<User | null>;
    findById(id: number): Promise<User | null>;
    create(user: Omit<User, 'id'>): Promise<User>;
}
import { Injectable } from "@nestjs/common";
import { UsersRepository } from "./users.repository.js";
import { User } from "./interfaces/user.interface.js";
import { randomInt } from "node:crypto";

@Injectable()
export class InMemoryUsersRepository implements UsersRepository {
    private users: User[] = [];

    async findByOAuthUserId(oAuthUserId: string): Promise<User | null> {
        return (this.users.find(user => user.oAuthUserId === oAuthUserId) ?? null);
    }

    async findById(id: number): Promise<User | null> {
        return (this.users.find(user => user.id === id) ?? null);
    }

    async create(user: Omit<User, 'id'>): Promise<User> {
        const newUser: User = {
            ...user,
            id: randomInt(3000)
        };

        this.users.push(newUser);

        return newUser;
    }
}
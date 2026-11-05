import { Module } from '@nestjs/common';
import { USERS_REPOSITORY } from './users.repository.js';
import { InMemoryUsersRepository } from './in-memory-users-repository.js';

@Module({
  providers: [
    {
      provide: USERS_REPOSITORY,
      useClass: InMemoryUsersRepository
    }
  ],
  exports: [USERS_REPOSITORY]
})
export class UsersModule {}

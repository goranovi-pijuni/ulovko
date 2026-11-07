import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { SessionSerializer } from './auth.serializer.js';
import { PassportModule } from '@nestjs/passport';
import { GoogleAuthGuard } from './guards/google-auth.guard.js';
import { AuthenticatedGuard } from './guards/authenticated.guard.js';
import { DatabaseModule } from '../database/database.module.js';


@Module({
  imports: [
    PassportModule.register({
      session: true,
    }),
    DatabaseModule
  ],
  providers: [
    GoogleStrategy,
    SessionSerializer,
    AuthService,
    GoogleAuthGuard,
    AuthenticatedGuard
  ],
  controllers: [AuthController],

  exports:[
    GoogleAuthGuard,
    AuthenticatedGuard
  ]
})
export class AuthModule {}

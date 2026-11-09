import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FlagSubmissionController } from './flag_submission.controller.js';
import {
  DatabaseFlagSubmissionRepository,
  FlagSubmissionRepository,
} from './flag_submission.repository.js';
import { FlagSubmissionService } from './flag_submission.service.js';

@Module({
  imports: [AuthModule],
  controllers: [FlagSubmissionController],
  providers: [
    FlagSubmissionService,
    {
      provide: FlagSubmissionRepository,
      useClass: DatabaseFlagSubmissionRepository,
    },
  ],
})
export class FlagSubmissionModule {}

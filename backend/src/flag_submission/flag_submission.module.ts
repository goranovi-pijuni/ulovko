import { Module } from '@nestjs/common';
import { FlagSubmissionController } from './flag_submission.controller.js';
import { FlagSubmissionService } from './flag_submission.service.js';

@Module({
  controllers: [FlagSubmissionController],
  providers: [FlagSubmissionService]
})
export class FlagSubmissionModule {}

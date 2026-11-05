import { Module } from '@nestjs/common';
import { FlagSubmissionController } from './flag_submission.controller.js';
import {
  FlagSubmissionRepository,
  FlagSubmissionService,
  InMemoryFlagSubmissionRepository,
} from './flag_submission.service.js';

@Module({
  controllers: [FlagSubmissionController],
  providers: [
    FlagSubmissionService,
    {
      // TODO: zamijeniti pravom implementacijom nad bazom kad bude dostupna.
      provide: FlagSubmissionRepository,
      useFactory: () => {
        const repository = new InMemoryFlagSubmissionRepository();
        if (process.env.FLAG_SUBMISSION_DEV === '1') {
          repository.seedDemoData();
        }
        return repository;
      },
    },
  ],
})
export class FlagSubmissionModule {}

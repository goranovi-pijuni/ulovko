import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { HealthModule } from './health/health.module.js';
import { FlagSubmissionModule } from './flag_submission/flag_submission.module.js';
import { CompetitionsModule } from './competitions/competitions.module.js';

@Module({
  imports: [HealthModule, FlagSubmissionModule, CompetitionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

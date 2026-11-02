import { Module } from '@nestjs/common';
import { CompetitionsController } from './competitions.controller.js';
import { CompetitionsService } from './competitions.service.js';

@Module({
  controllers: [CompetitionsController],
  providers: [CompetitionsService],
})
export class CompetitionsModule {}

import { Module } from '@nestjs/common';
import { CompetitionsController } from './competitions.controller.js';
import { CompetitionsService } from './competitions.service.js';
import { ArchiveService } from '../challenge-packages/archive.service.js';
import { R2Service } from '../challenge-packages/r2.service.js';

@Module({
  controllers: [CompetitionsController],
  providers: [CompetitionsService, ArchiveService, R2Service],
})
export class CompetitionsModule {}

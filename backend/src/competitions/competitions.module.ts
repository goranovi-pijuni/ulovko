import { Module } from '@nestjs/common';
import { CompetitionsController } from './competitions.controller.js';
import { CompetitionsService } from './competitions.service.js';
import { ArchiveService } from '../challenge-packages/archive.service.js';
import { R2Service } from '../challenge-packages/r2.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { CompetitionOwnerGuard } from './guards/competition-owner.guard.js';

@Module({
  imports: [AuthModule, RolesModule],
  controllers: [CompetitionsController],
  providers: [
    CompetitionsService,
    ArchiveService,
    R2Service,
    CompetitionOwnerGuard,
  ],
})
export class CompetitionsModule {}

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { competitions } from '../../database/schema.js';
import { Role } from '../../roles/roles.enum.js';

@Injectable()
export class CompetitionOwnerGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Morate biti prijavljeni');

    // Guards run before ParseIntPipe; validate the route parameter here.
    const rawId = request.params.competitionId;
    const competitionId = Number(rawId);
    if (
      !/^[1-9]\d*$/.test(rawId) ||
      !Number.isSafeInteger(competitionId) ||
      competitionId > 2147483647
    ) {
      throw new BadRequestException('Neispravan competitionId');
    }

    const [competition] = await this.database.db
      .select({ organizedBy: competitions.organizedBy })
      .from(competitions)
      .where(eq(competitions.id, competitionId))
      .limit(1);

    if (!competition) throw new NotFoundException('Natjecanje nije pronađeno');
    if (user.permLevel === Role.ADMIN || competition.organizedBy === user.id)
      return true;

    throw new ForbiddenException('Niste organizator ovog natjecanja');
  }
}

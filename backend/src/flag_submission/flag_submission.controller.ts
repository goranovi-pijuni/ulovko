import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import {
  FlagSubmissionService,
  type SubmissionResult,
  type SubmissionStatus,
} from './flag_submission.service.js';

export const MAX_FLAG_LENGTH = 512;

export class SubmitFlagDto {
  @ApiProperty({ description: 'ID zadatka', example: 1 })
  challengeId!: number;

  @ApiProperty({
    description: 'Predana zastavica',
    example: 'FLAG{primjer}',
    maxLength: MAX_FLAG_LENGTH,
  })
  flag!: string;
}

export class SubmissionResponseDto implements SubmissionResult {
  @ApiProperty({ enum: ['correct', 'incorrect', 'already_solved'] })
  status!: SubmissionStatus;

  @ApiProperty({ example: 1 })
  challengeId!: number;
}

/** Zahtjev u kojem je autentikacijski guard (kad postoji) postavio `user`. */
type AuthenticatedRequest = Request & { user?: { id?: unknown } };

@Controller('flag-submission')
export class FlagSubmissionController {
  constructor(private readonly flagSubmissionService: FlagSubmissionService) {}

  @Post() // POST /api/flag-submission
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Predaja zastavice za zadatak' })
  @ApiOkResponse({
    description:
      'Rezultat provjere: correct, incorrect ili already_solved (tim je već riješio zadatak)',
    type: SubmissionResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Neispravno tijelo zahtjeva' })
  @ApiUnauthorizedResponse({ description: 'Korisnik nije prijavljen' })
  @ApiForbiddenResponse({
    description: 'Natjecanje nije aktivno ili korisnik nije član tima',
  })
  @ApiNotFoundResponse({
    description: 'Zadatak nije pronađen ili nije objavljen',
  })
  @ApiTooManyRequestsResponse({
    description: 'Previše pokušaja za ovaj zadatak',
  })
  submit(
    @Req() req: AuthenticatedRequest,
    @Body() body: SubmitFlagDto,
  ): Promise<SubmissionResult> {
    const userId = this.resolveUserId(req);
    const { challengeId, flag } = this.validate(body);
    return this.flagSubmissionService.submit(userId, challengeId, flag);
  }

  /**
   * Identitet dolazi isključivo iz sesije (`req.user`, postavlja ga auth guard),
   * nikada iz tijela zahtjeva. Dok auth ne postoji, za lokalni razvoj postoji
   * zaobilaznica preko zaglavlja X-User-Id koja je isključena osim ako je
   * postavljeno FLAG_SUBMISSION_DEV=1 (NODE_ENV se u deployu ne postavlja).
   */
  private resolveUserId(req: AuthenticatedRequest): number {
    let candidate: unknown = req.user?.id;

    if (candidate === undefined && process.env.FLAG_SUBMISSION_DEV === '1') {
      candidate = req.headers['x-user-id'];
    }

    const id = Number(candidate);
    if (candidate === undefined || !Number.isInteger(id) || id <= 0) {
      throw new UnauthorizedException('Potrebna je prijava');
    }
    return id;
  }

  private validate(body: unknown): SubmitFlagDto {
    const { challengeId, flag } = (body ?? {}) as Partial<
      Record<keyof SubmitFlagDto, unknown>
    >;

    if (
      typeof challengeId !== 'number' ||
      !Number.isInteger(challengeId) ||
      challengeId <= 0
    ) {
      throw new BadRequestException(
        'challengeId mora biti pozitivan cijeli broj',
      );
    }
    if (typeof flag !== 'string' || flag.trim().length === 0) {
      throw new BadRequestException('flag mora biti neprazan tekst');
    }
    if (flag.length > MAX_FLAG_LENGTH) {
      throw new BadRequestException(
        `flag može imati najviše ${MAX_FLAG_LENGTH} znakova`,
      );
    }
    return { challengeId, flag };
  }
}

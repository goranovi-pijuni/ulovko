import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthenticatedGuard } from '../auth/guards/authenticated.guard.js';
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

@Controller('flag-submission')
@UseGuards(AuthenticatedGuard)
@ApiCookieAuth('session')
export class FlagSubmissionController {
  constructor(private readonly flagSubmissionService: FlagSubmissionService) {}

  @Post()
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
    @Req() req: Request,
    @Body() body: SubmitFlagDto,
  ): Promise<SubmissionResult> {
    const { challengeId, flag } = this.validate(body);
    return this.flagSubmissionService.submit(req.user!.id, challengeId, flag);
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

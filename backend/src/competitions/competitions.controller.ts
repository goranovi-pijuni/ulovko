import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { tmpdir } from 'node:os';
import type { Request } from 'express';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard.js';
import { RoleGuard } from '../roles/role.guard.js';
import { Roles } from '../roles/roles.decorator.js';
import { Role } from '../roles/roles.enum.js';
import { CompetitionOwnerGuard } from './guards/competition-owner.guard.js';
import { CompetitionDto } from './dto/competition.dto.js';
import { CreateCompetitionDto } from './dto/create-competition.dto.js';
import { MAX_UPLOAD_BYTES } from '../challenge-packages/archive.service.js';
import { CompetitionsService } from './competitions.service.js';
import type { Competition } from './interfaces/competition.interface.js';

@ApiTags('competitions')
@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvat svih natjecanja' })
  @ApiOkResponse({ type: CompetitionDto, isArray: true })
  getCompetitions(): Promise<Competition[]> {
    return this.competitionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Dohvat natjecanja prema ID-u' })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID natjecanja',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Natjecanje uspješno dohvaćeno',
    type: CompetitionDto,
  })
  @ApiBadRequestResponse({ description: 'ID mora biti cijeli broj' })
  @ApiNotFoundResponse({ description: 'Natjecanje nije pronađeno' })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<Competition> {
    const result = await this.competitionsService.findById(id);
    if (!result)
      throw new NotFoundException(`Competition with ID ${id} not found`);
    return result;
  }

  @Post()
  @UseGuards(AuthenticatedGuard, RoleGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  @ApiCookieAuth('session')
  @ApiOperation({
    summary:
      'Stvaranje natjecanja i R2 bucketa (organizator ili administrator)',
  })
  @ApiCreatedResponse({
    description: 'Natjecanje stvoreno',
    type: CompetitionDto,
  })
  @ApiBadRequestResponse({
    description:
      'Neispravni podaci ili nedopušteno polje (uključujući organisedBy)',
  })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  @ApiForbiddenResponse({
    description: 'Potrebna je uloga organizatora ili administratora',
  })
  createCompetition(
    @Body() body: CreateCompetitionDto,
    @Req() request: Request,
  ) {
    return this.competitionsService.createCompetition(body, request.user!.id);
  }

  @Get(':id/challenges')
  @ApiOperation({ summary: 'Popis zadataka natjecanja, bez zastavica' })
  listChallenges(@Param('id', ParseIntPipe) id: number) {
    return this.competitionsService.listChallenges(id);
  }

  @Get(':compId/:taskId/handout')
  @UseGuards(AuthenticatedGuard)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Preuzimanje ZIP handouta zadatka preko API-ja' })
  @ApiParam({ name: 'compId', type: Number, description: 'ID natjecanja' })
  @ApiParam({ name: 'taskId', type: Number, description: 'ID zadatka' })
  @ApiOkResponse({
    description: 'ZIP arhiva (application/zip, attachment)',
    content: {
      'application/zip': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava putem Googlea' })
  @ApiForbiddenResponse({ description: 'Korisnik nije sudionik natjecanja' })
  @ApiNotFoundResponse({
    description: 'Zadatak ne postoji, nije objavljen ili nema handout',
  })
  @ApiBadRequestResponse({ description: 'Neispravan ID' })
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  downloadHandout(
    @Param('compId', ParseIntPipe) compId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() request: Request,
  ) {
    return this.competitionsService.downloadHandout(
      compId,
      taskId,
      request.user!,
    );
  }

  @Post(':competitionId/challenges')
  @UseGuards(AuthenticatedGuard, RoleGuard, CompetitionOwnerGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiCookieAuth('session')
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  @ApiForbiddenResponse({
    description:
      'Potrebno je vlasništvo nad natjecanjem ili administratorska uloga',
  })
  @ApiNotFoundResponse({ description: 'Natjecanje nije pronađeno' })
  @ApiBadRequestResponse({
    description: 'Neispravan ID, podaci ili ZIP arhiva',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      dest: tmpdir(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 12, parts: 13 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Predaja ZIP arhive CTF zadatka' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'file',
        'challengeTitle',
        'publishingDate',
        'flag',
        'categoryId',
      ],
      properties: {
        file: { type: 'string', format: 'binary' },
        challengeTitle: { type: 'string' },
        challengeDescription: { type: 'string' },
        publishingDate: { type: 'string', format: 'date-time' },
        isPublic: { type: 'boolean' },
        flag: { type: 'string' },
        points: { type: 'integer' },
        deployId: { type: 'integer' },
        competitionId: { type: 'integer' },
        categoryId: { type: 'integer' },
      },
    },
  })
  @HttpCode(HttpStatus.CREATED)
  uploadChallenge(
    @Param('competitionId', ParseIntPipe) competitionId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.competitionsService.uploadChallenge(competitionId, file, body);
  }
}

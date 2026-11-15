import {
  Body,
  Controller,
  Get,
  Patch,
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
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
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
import { PublicChallengeDto } from './dto/public-challenge.dto.js';
import { OrganizerChallengeDto } from './dto/organizer-challenge.dto.js';
import { ChallengeCategoryDto } from './dto/challenge-category.dto.js';
import { DeploymentStatusDto } from './dto/deployment-status.dto.js';
import { ChallengeEndpointDto } from './dto/challenge-endpoint.dto.js';
import { ChallengeDeploymentsService } from './challenge-deployments.service.js';
import { CreateCompetitionDto } from './dto/create-competition.dto.js';
import { MAX_UPLOAD_BYTES } from '../challenge-packages/archive.service.js';
import { CompetitionsService } from './competitions.service.js';
import type { Competition } from './interfaces/competition.interface.js';

@ApiTags('competitions')
@Controller('competitions')
export class CompetitionsController {
  constructor(
    private readonly competitionsService: CompetitionsService,
    private readonly deploymentService: ChallengeDeploymentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Dohvat svih natjecanja' })
  @ApiOkResponse({ type: CompetitionDto, isArray: true })
  getCompetitions(): Promise<Competition[]> {
    return this.competitionsService.findAll();
  }

  @Get('challenge-categories')
  @UseGuards(AuthenticatedGuard, RoleGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Kategorije zadataka za organizatore' })
  @ApiOkResponse({ type: ChallengeCategoryDto, isArray: true })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  @ApiForbiddenResponse({ description: 'Potrebna je organizatorska uloga' })
  listChallengeCategories(): Promise<ChallengeCategoryDto[]> {
    return this.competitionsService.listChallengeCategories();
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
  @ApiOperation({ summary: 'Popis javno dostupnih zadataka natjecanja' })
  @ApiParam({ name: 'id', type: Number, description: 'ID natjecanja' })
  @ApiOkResponse({
    description: 'Objavljeni javni zadaci, bez zastavica',
    type: PublicChallengeDto,
    isArray: true,
  })
  @ApiBadRequestResponse({ description: 'ID mora biti cijeli broj' })
  @ApiNotFoundResponse({ description: 'Natjecanje nije pronađeno' })
  listChallenges(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PublicChallengeDto[]> {
    return this.competitionsService.listChallenges(id);
  }

  @Get(':competitionId/challenges/:challengeId/endpoints')
  @ApiOperation({ summary: 'Javne adrese pokrenutih servisa objavljenog zadatka' })
  @ApiParam({ name: 'competitionId', type: Number })
  @ApiParam({ name: 'challengeId', type: Number })
  @ApiOkResponse({ type: ChallengeEndpointDto, isArray: true })
  @ApiNotFoundResponse({ description: 'Zadatak nije javno objavljen' })
  publicChallengeEndpoints(
    @Param('competitionId', ParseIntPipe) competitionId: number,
    @Param('challengeId', ParseIntPipe) challengeId: number,
  ): Promise<ChallengeEndpointDto[]> {
    return this.deploymentService.publishedEndpoints(competitionId, challengeId);
  }

  @Get(':competitionId/organizer/challenges')
  @UseGuards(AuthenticatedGuard, RoleGuard, CompetitionOwnerGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Svi zadaci natjecanja za organizatora' })
  @ApiParam({ name: 'competitionId', type: Number, description: 'ID natjecanja' })
  @ApiOkResponse({
    type: OrganizerChallengeDto,
    isArray: true,
    description: 'Svi zadaci, uključujući neobjavljene, bez zastavica',
  })
  @ApiBadRequestResponse({ description: 'Neispravan ID natjecanja' })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  @ApiForbiddenResponse({ description: 'Niste organizator ovog natjecanja' })
  @ApiNotFoundResponse({ description: 'Natjecanje nije pronađeno' })
  listOrganizerChallenges(
    @Param('competitionId', ParseIntPipe) competitionId: number,
  ): Promise<OrganizerChallengeDto[]> {
    return this.competitionsService.listOrganizerChallenges(competitionId);
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
        'isPublic',
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

  @Patch(':competitionId/organizer/challenges/:challengeId')
  @UseGuards(AuthenticatedGuard, RoleGuard, CompetitionOwnerGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiCookieAuth('session')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    dest: tmpdir(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 12, parts: 13 },
  }))
  @ApiOperation({ summary: 'Izmjena zadatka i neobavezna zamjena ZIP arhive' })
  @ApiBody({ schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
      challengeTitle: { type: 'string' },
      challengeDescription: { type: 'string' },
      publishingDate: { type: 'string', format: 'date-time' },
      isPublic: { type: 'boolean' },
      flag: { type: 'string', description: 'Izostaviti za zadržavanje postojeće zastavice' },
      points: { type: 'integer', nullable: true },
      categoryId: { type: 'integer' },
    },
  } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Ažurirano' })
  @ApiNotFoundResponse({ description: 'Zadatak nije pronađen' })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  @ApiForbiddenResponse({ description: 'Niste organizator natjecanja' })
  @ApiConflictResponse({ description: 'Izgradnja je u tijeku' })
  updateChallenge(
    @Param('competitionId', ParseIntPipe) competitionId: number,
    @Param('challengeId', ParseIntPipe) challengeId: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, unknown>,
  ): Promise<void> {
    return this.competitionsService.updateChallenge(competitionId, challengeId, file, body);
  }

  @Post(':competitionId/organizer/challenges/:challengeId/deploy')
  @UseGuards(AuthenticatedGuard, RoleGuard, CompetitionOwnerGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiCookieAuth('session')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ručno pokreni izgradnju i objavu servisa zadatka' })
  @ApiAcceptedResponse({ type: DeploymentStatusDto })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  @ApiForbiddenResponse({ description: 'Niste organizator natjecanja' })
  @ApiNotFoundResponse({ description: 'Zadatak nije pronađen' })
  @ApiConflictResponse({ description: 'Zadatak je već pokrenut ili nema deploy datoteke' })
  deployChallenge(
    @Param('competitionId', ParseIntPipe) competitionId: number,
    @Param('challengeId', ParseIntPipe) challengeId: number,
  ) {
    return this.deploymentService.start(competitionId, challengeId);
  }

  @Get(':competitionId/organizer/challenges/:challengeId/deployment')
  @UseGuards(AuthenticatedGuard, RoleGuard, CompetitionOwnerGuard)
  @Roles(Role.ORGANIZER, Role.ADMIN)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Stanje izgradnje i objave zadatka' })
  @ApiOkResponse({ type: DeploymentStatusDto })
  @ApiUnauthorizedResponse({ description: 'Potrebna je prijava' })
  @ApiForbiddenResponse({ description: 'Niste organizator natjecanja' })
  @ApiNotFoundResponse({ description: 'Zadatak nije pronađen' })
  deploymentStatus(
    @Param('competitionId', ParseIntPipe) competitionId: number,
    @Param('challengeId', ParseIntPipe) challengeId: number,
  ) {
    return this.deploymentService.status(competitionId, challengeId);
  }

}

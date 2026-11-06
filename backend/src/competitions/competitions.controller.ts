import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { tmpdir } from 'node:os';
import { MAX_UPLOAD_BYTES } from '../challenge-packages/archive.service.js';
import { CompetitionsService } from './competitions.service.js';
import type { Competition } from './interfaces/competition.interface.js';

@ApiTags('competitions')
@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvat svih natjecanja' })
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
  @ApiOkResponse({ description: 'Natjecanje uspješno dohvaćeno' })
  @ApiBadRequestResponse({ description: 'ID mora biti cijeli broj' })
  @ApiNotFoundResponse({ description: 'Natjecanje nije pronađeno' })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<Competition> {
    const result = await this.competitionsService.findById(id);
    if (!result)
      throw new NotFoundException(`Competition with ID ${id} not found`);
    return result;
  }

  @Post()
  @ApiOperation({ summary: 'Stvaranje natjecanja i R2 bucketa' })
  @ApiCreatedResponse({ description: 'Natjecanje stvoreno' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'startsAt', 'endsAt', 'organisedBy'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        startsAt: { type: 'string', format: 'date-time' },
        endsAt: { type: 'string', format: 'date-time' },
        organisedBy: { type: 'integer' },
        min: { type: 'integer' },
        max: { type: 'integer' },
        decay: { type: 'integer' },
      },
    },
  })
  createCompetition(@Body() body: Record<string, unknown>) {
    return this.competitionsService.createCompetition(body);
  }

  @Get(':id/challenges')
  @ApiOperation({ summary: 'Popis zadataka natjecanja, bez zastavica' })
  listChallenges(@Param('id', ParseIntPipe) id: number) {
    return this.competitionsService.listChallenges(id);
  }

  @Post(':competitionId/challenges')
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
        flag: { type: 'string' },
        categoryId: { type: 'integer' },
        points: { type: 'integer' },
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

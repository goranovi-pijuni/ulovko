import {
  Controller,
  Get,
  Post,
  Param,
  ParseIntPipe,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  Body,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import type { Express } from 'express';
import { CompetitionsService } from './competitions.service.js';
import type { Competition } from './interfaces/competition.interface.js';
import type { Challenge } from './interfaces/challenge.interface.js';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';

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

    if (result === undefined) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }

    return result;
  }
  @Post(':competitionId/challenges')
  @UseInterceptors(FileInterceptor('file'))
  uploadChallenge(
    @Param('competitionId', ParseIntPipe) competitionId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Challenge,
  ) {
    return this.competitionsService.uploadChallenge(competitionId, file, body);
  }
}

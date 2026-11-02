import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';

import { CompetitionsService } from './competitions.service.js';
import type { Competition } from './interfaces/competition.interface.js';

@Controller('competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Get()
  @ApiOperation({ summary: 'Dohvat svih natjecanja' })
  getCompetitions(): Array<Competition> {
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
  getById(@Param('id', ParseIntPipe) id: number): Competition {
    const result = this.competitionsService.findById(id);

    if (result === undefined) {
      throw new NotFoundException(`Competition with ID ${id} not found`);
    }

    return result;
  }
}

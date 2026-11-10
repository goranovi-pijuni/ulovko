import { ApiProperty } from '@nestjs/swagger';
import type {
  Competition,
  CompetitionStatus,
} from '../interfaces/competition.interface.js';

// Response shape for the OpenAPI contract; the frontend generates its types
// from it with Orval. Keep in sync with the Competition interface.
export class CompetitionDto implements Competition {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'FER CTF 2026' })
  name!: string;

  @ApiProperty({ example: 'Natjecanje za studente' })
  description!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-12-01T10:00:00.000Z',
  })
  startsAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-12-02T10:00:00.000Z',
  })
  endsAt!: Date;

  @ApiProperty({
    enum: ['upcoming', 'active', 'finished'],
    enumName: 'CompetitionStatus',
  })
  status!: CompetitionStatus;

  @ApiProperty({ description: 'ID organizatora natjecanja', example: 1 })
  organisedBy!: number;

  @ApiProperty({ example: 0 })
  teamCount!: number;
}

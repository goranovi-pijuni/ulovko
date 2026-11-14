import { ApiProperty } from '@nestjs/swagger';

// Metadata exposed by the public challenge listing. Do not add flags,
// deployment details or storage information to this response.
export class PublicChallengeDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Cookie Monster' })
  challengeTitle!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Pronađi ranjivost.' })
  challengeDescription!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-12-01T10:00:00.000Z',
  })
  publishingDate!: Date;

  @ApiProperty({ type: Number, nullable: true, example: 100 })
  points!: number | null;

  @ApiProperty({ example: 'Web' })
  categoryName!: string;
}

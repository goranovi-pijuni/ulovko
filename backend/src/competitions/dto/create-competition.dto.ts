import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const timezoneDate =
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/;

export class CreateCompetitionDto {
  @ApiProperty({ example: 'FER CTF 2026', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Natjecanje za studente', maxLength: 10000 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  description?: string;

  @ApiProperty({ example: '2026-12-01T10:00:00Z', format: 'date-time' })
  @IsString()
  @Matches(timezoneDate, {
    message: 'startsAt mora biti ISO 8601 datum s vremenskom zonom',
  })
  startsAt!: string;

  @ApiProperty({ example: '2026-12-02T10:00:00Z', format: 'date-time' })
  @IsString()
  @Matches(timezoneDate, {
    message: 'endsAt mora biti ISO 8601 datum s vremenskom zonom',
  })
  endsAt!: string;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  min?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  max?: number;

  @ApiPropertyOptional({ type: Number, minimum: 0 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  decay?: number;
}

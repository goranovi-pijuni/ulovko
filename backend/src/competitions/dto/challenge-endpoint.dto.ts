import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Only public HTTP(S) URLs or TCP host/port information from the runner.
export class ChallengeEndpointDto {
  @ApiProperty({ example: 'web1' })
  service!: string;

  @ApiProperty({ example: true })
  ready!: boolean;

  @ApiProperty({ enum: ['http', 'https', 'tcp'] })
  protocol!: 'http' | 'https' | 'tcp';

  @ApiPropertyOptional({ example: 'https://abc.chal.ulovko.fun/' })
  url?: string;

  @ApiPropertyOptional({ example: 'tcp.chal.ulovko.fun' })
  host?: string;

  @ApiPropertyOptional({ example: 31001 })
  port?: number;
}

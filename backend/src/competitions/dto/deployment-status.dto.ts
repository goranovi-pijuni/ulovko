import { ApiProperty } from '@nestjs/swagger';
import { ChallengeEndpointDto } from './challenge-endpoint.dto.js';

export class DeploymentStatusDto {
  @ApiProperty({ enum: ['uploaded', 'building', 'built', 'deployed', 'error'], nullable: true })
  status!: 'uploaded' | 'building' | 'built' | 'deployed' | 'error' | null;

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;

  @ApiProperty({ type: [ChallengeEndpointDto] })
  endpoints!: ChallengeEndpointDto[];
}

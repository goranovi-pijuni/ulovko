import { ApiProperty } from "@nestjs/swagger";
import { PublicChallengeDto } from "./public-challenge.dto.js";

// Owner/admin view. Excludes flags, deployment internals and R2 keys.
export class OrganizerChallengeDto extends PublicChallengeDto {
  @ApiProperty({ example: 1 })
  categoryId!: number;

  @ApiProperty({ example: false })
  isPublic!: boolean;

  @ApiProperty({ example: false })
  hasDeploy!: boolean;
}

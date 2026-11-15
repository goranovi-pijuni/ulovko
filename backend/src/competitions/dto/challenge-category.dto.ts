import { ApiProperty } from '@nestjs/swagger';

export class ChallengeCategoryDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'Web' })
  categoryName!: string;
}

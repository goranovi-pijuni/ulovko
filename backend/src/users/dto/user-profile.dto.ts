import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../roles/roles.enum.js';
import type { User } from '../interfaces/user.interface.js';

// Public view of the signed-in user. Never include oauthUserId or the avatar
// buffer; the frontend generates its session type from this class.
export class UserProfileDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: 'ivana@example.com' })
  email!: string;

  @ApiProperty({ example: 'Ivana' })
  displayName!: string;

  @ApiProperty({
    enum: [Role.USER, Role.ORGANIZER, Role.ADMIN],
    description: '1 = natjecatelj, 2 = organizator, 3 = administrator',
    example: Role.USER,
  })
  permLevel!: number;

  static fromUser(user: User): UserProfileDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      permLevel: user.permLevel,
    };
  }
}

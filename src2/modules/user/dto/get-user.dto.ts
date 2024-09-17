// src/user/dto/get-user.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class GetUserDto {
  @ApiProperty({
    description: 'Unique identifier for the user',
    example: 'uuid',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({ description: 'User full name', example: 'John Doe' })
  name: string;

  @ApiProperty({ description: 'Timestamp when the user was created' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the user was last updated' })
  updatedAt: Date;
}

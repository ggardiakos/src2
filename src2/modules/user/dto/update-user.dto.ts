import { PartialType } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'newStrongPassword123',
    required: false,
  })
  @IsOptional()
  @MinLength(6)
  password?: string;
}

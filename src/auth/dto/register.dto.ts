import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  MinLength,
} from "class-validator";

import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "John" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: "Doe" })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: "admin@example.com" })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: "password123" })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(72) // bcrypt accepts max 72 characters for password
  password!: string;
}

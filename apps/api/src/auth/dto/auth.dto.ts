import { IsEmail, IsString, MinLength, IsOptional, IsIn } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "password123", minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiPropertyOptional({ example: "Иван" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ["USER", "COMPOSER"], default: "USER" })
  @IsOptional()
  @IsIn(["USER", "COMPOSER"])
  role?: "USER" | "COMPOSER";
}

export class LoginDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "password123" })
  @IsString()
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class UpdateRoleDto {
  @ApiProperty({ enum: ["USER", "COMPOSER", "ADMIN"] })
  @IsIn(["USER", "COMPOSER", "ADMIN"])
  role!: "USER" | "COMPOSER" | "ADMIN";
}

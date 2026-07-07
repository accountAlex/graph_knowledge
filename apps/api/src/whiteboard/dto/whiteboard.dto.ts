import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateWhiteboardDto {
  @ApiPropertyOptional({ example: "Доска по тригонометрии" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: "Optional KG node id to link the board to" })
  @IsOptional()
  @IsString()
  nodeId?: string;
}

export class UpdateWhiteboardDto {
  @ApiProperty({ example: "Новое название доски" })
  @IsString()
  @MaxLength(200)
  title!: string;
}

export class AddMemberDto {
  @ApiProperty({ example: "student@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ["VIEWER", "EDITOR"], default: "EDITOR" })
  @IsOptional()
  @IsIn(["VIEWER", "EDITOR"])
  role?: "VIEWER" | "EDITOR";
}

export class UpdateMemberDto {
  @ApiProperty({ enum: ["VIEWER", "EDITOR"] })
  @IsIn(["VIEWER", "EDITOR"])
  role!: "VIEWER" | "EDITOR";
}

export class ShareLinkDto {
  @ApiProperty({ enum: ["VIEWER", "EDITOR"], default: "EDITOR" })
  @IsIn(["VIEWER", "EDITOR"])
  role!: "VIEWER" | "EDITOR";
}

export class JoinBoardDto {
  @ApiProperty({ description: "Share link token" })
  @IsString()
  token!: string;
}

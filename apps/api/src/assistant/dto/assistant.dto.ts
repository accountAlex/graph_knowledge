import { IsString, IsOptional, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ChatMessageDto {
  @ApiProperty({ enum: ["user", "assistant"], example: "user" })
  @IsString()
  role: "user" | "assistant";

  @ApiProperty({ example: "Объясни дискриминант" })
  @IsString()
  content: string;
}

export class AskDto {
  @ApiProperty({ example: "Как решать квадратные уравнения?" })
  @IsString()
  question: string;

  @ApiPropertyOptional({ description: "Topic ID for context" })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ description: "Previous messages for multi-turn chat", type: [ChatMessageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  history?: ChatMessageDto[];
}

export class CreateSessionDto {
  @ApiPropertyOptional({ description: "Topic ID for context" })
  @IsOptional()
  @IsString()
  topicId?: string;
}

export class SendMessageDto {
  @ApiProperty({ example: "Что такое дискриминант?" })
  @IsString()
  question: string;
}

export interface AskResponse {
  answer: string;
}

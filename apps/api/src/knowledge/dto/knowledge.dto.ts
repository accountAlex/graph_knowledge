import { IsString, IsEnum, IsOptional, IsUUID, IsArray, ValidateNested, IsBoolean } from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { TopicNodeRole, EdgeKind, NodeStatus } from "@mathgraph/shared";

const NODE_ROLES = ["TOPIC", "CONCEPT", "METHOD", "SKILL", "TASK"] as const;
const EDGE_TYPES = ["PREREQ_REQUIRED", "CONTAINS"] as const;
const NODE_STATUSES = ["DRAFT", "PUBLISHED"] as const;

export class CreateNodeDto {
  @ApiProperty({ example: "Квадратные уравнения" })
  @IsString()
  title!: string;

  @ApiProperty({ enum: NODE_ROLES, example: "TOPIC" })
  @IsEnum(NODE_ROLES, { message: "role must be one of: TOPIC, CONCEPT, METHOD, SKILL, TASK" })
  role!: TopicNodeRole;

  @ApiPropertyOptional({ example: "Уравнения вида ax² + bx + c = 0" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "Полное объяснение темы..." })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: ["https://math.ru/quadratic"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resources?: string[];

  @ApiPropertyOptional({ example: "2.1.3", description: "Код ФИПИ" })
  @IsOptional()
  @IsString()
  fipiCode?: string;

  @ApiPropertyOptional({ description: "Creates CONTAINS edge from parent topic" })
  @IsOptional()
  @IsUUID()
  parentTopicId?: string;
}

export class UpdateNodeDto {
  @ApiPropertyOptional({ example: "Линейные уравнения" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: NODE_ROLES })
  @IsOptional()
  @IsEnum(NODE_ROLES, { message: "role must be one of: TOPIC, CONCEPT, METHOD, SKILL, TASK" })
  role?: TopicNodeRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  resources?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fipiCode?: string;
}

export class UpdateStatusDto {
  @ApiProperty({ enum: NODE_STATUSES, example: "PUBLISHED" })
  @IsEnum(NODE_STATUSES, { message: "status must be DRAFT or PUBLISHED" })
  status!: NodeStatus;
}

// ── Import / Export ──────────────────────────────────────────────────────────

export class ImportNodeDto {
  @IsOptional() @IsUUID()   id?: string;
  @IsString()               title!: string;
  @IsEnum(NODE_ROLES)       role!: TopicNodeRole;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) resources?: string[];
  @IsOptional() @IsString() fipiCode?: string;
  @IsOptional() @IsEnum(["DRAFT", "PUBLISHED"]) status?: "DRAFT" | "PUBLISHED";
}

export class ImportEdgeDto {
  @IsString() from!: string;
  @IsString() to!: string;
  @IsEnum(EDGE_TYPES) type!: EdgeKind;
}

export class ImportGraphDto {
  @ValidateNested({ each: true }) @Type(() => ImportNodeDto) @IsArray()
  nodes!: ImportNodeDto[];

  @ValidateNested({ each: true }) @Type(() => ImportEdgeDto) @IsArray()
  edges!: ImportEdgeDto[];

  /** If true, update existing nodes instead of skipping them */
  @IsOptional() @IsBoolean()
  overwrite?: boolean;
}

export class CreateEdgeDto {
  @ApiProperty({ description: "Source node ID" })
  @IsUUID()
  from!: string;

  @ApiProperty({ description: "Target node ID" })
  @IsUUID()
  to!: string;

  @ApiProperty({ enum: EDGE_TYPES, example: "PREREQ_REQUIRED" })
  @IsEnum(EDGE_TYPES, { message: "type must be one of: PREREQ_REQUIRED, CONTAINS" })
  type!: EdgeKind;
}

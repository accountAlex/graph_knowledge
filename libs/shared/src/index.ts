// ── Node & Edge enums ──

export type TopicNodeRole = "TOPIC" | "CONCEPT" | "METHOD" | "SKILL" | "TASK";
export type EdgeKind = "PREREQ_REQUIRED" | "CONTAINS";
export type SlotKind = "CORE" | "METHODS" | "SKILLS" | "TASKS";
export type SlotState = "visible" | "placeholder";

// ── Topic Page ──

export interface TopicPageNode {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  resources: string[];
  role: TopicNodeRole;
  isExternal: boolean;
  fipiCode: string | null;
}

export interface TopicPageEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface TopicPageSlot {
  kind: SlotKind;
  state: SlotState;
  minDepthToExpand: number;
  totalCount: number;
  orderedNodeIds: string[];
}

export interface TopicPagePayload {
  topicId: string;
  track: string;
  depth: number;
  nodes: TopicPageNode[];
  edges: TopicPageEdge[];
  slots: TopicPageSlot[];
}

// ── Roadmap ──

export interface RoadmapNode {
  id: string;
  title: string;
  description: string | null;
  role: TopicNodeRole;
  parentTopicId: string | null;
}

export interface RoadmapEdge {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface RoadmapPayload {
  depth: number;
  track: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
}

// ── Topics list ──

export interface TopicListItem {
  id: string;
  title: string;
}

// ── Study Plan ──

export interface StudyPlanItem {
  id: string;
  title: string;
}

// ── Auth ──

export type UserRole = "USER" | "COMPOSER" | "ADMIN";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

// ── Admin ──

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

// ── Chat / Assistant ──

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  topicId: string | null;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  topicId: string | null;
  messages: ChatMessage[];
}

// ── Progress ──

export type MasteryLevel = "UNSEEN" | "SEEN" | "PRACTICED" | "MASTERED";

export type LearningEventType =
  | "VIEW"
  | "COMPLETE"
  | "UNCOMPLETE"
  | "QUIZ_CORRECT"
  | "QUIZ_WRONG"
  | "REVIEW"
  | "MASTERY_CHANGE";

export interface TopicProgress {
  total: number;
  completed: number;
  nodes: Array<{
    nodeId: string;
    completed: boolean;
    mastery: MasteryLevel;
    confidence: number | null;
  }>;
}

export interface ProgressSummaryItem {
  topicId: string;
  total: number;
  completed: number;
}

export interface LearningEvent {
  id: string;
  nodeId: string;
  type: LearningEventType;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityDay {
  date: string;   // YYYY-MM-DD
  count: number;
}

export interface AnalyticsData {
  totalCompleted: number;
  streak: number;
  longestStreak: number;
  velocity7d: number;
  activeDays30: number;
  bestDay: ActivityDay | null;
  activityByDay: ActivityDay[];
}

// ── Publishing ──

export type NodeStatus = "DRAFT" | "PUBLISHED";

// ── Knowledge CRUD ──

export interface KgNodeDetail {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  resources: string[];
  role: TopicNodeRole;
  status: "DRAFT" | "PUBLISHED";
  fipiCode: string | null;
}

export interface CreateNodeDto {
  title: string;
  role: TopicNodeRole;
  description?: string;
  content?: string;
  resources?: string[];
  fipiCode?: string;
  parentTopicId?: string;
}

export interface UpdateNodeDto {
  title?: string;
  role?: TopicNodeRole;
  description?: string;
  content?: string;
  resources?: string[];
  fipiCode?: string;
}

export interface CreateEdgeDto {
  from: string;
  to: string;
  type: EdgeKind;
}

// ──────── Whiteboard (collaborative board) ────────
export type WhiteboardRole = "VIEWER" | "EDITOR";
export type WhiteboardEffectiveRole = "OWNER" | WhiteboardRole;

export interface WhiteboardUserRef {
  id: string;
  email: string;
  name: string | null;
}

export interface WhiteboardSummary {
  id: string;
  title: string;
  ownerId: string;
  nodeId: string | null;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  role: WhiteboardEffectiveRole;
}

export interface WhiteboardMemberInfo {
  id: string;
  whiteboardId: string;
  userId: string;
  role: WhiteboardRole;
  createdAt: string;
  user: WhiteboardUserRef;
}

export interface WhiteboardDetail {
  id: string;
  title: string;
  ownerId: string;
  nodeId: string | null;
  createdAt: string;
  updatedAt: string;
  role: WhiteboardEffectiveRole;
  owner: WhiteboardUserRef;
  members: WhiteboardMemberInfo[];
  // Present only for the owner.
  shareToken?: string | null;
  shareRole?: WhiteboardRole | null;
}

export interface WhiteboardShareLink {
  shareToken: string;
  shareRole: WhiteboardRole;
}

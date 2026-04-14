export type TopicNodeRole = "TOPIC" | "CONCEPT" | "METHOD" | "SKILL" | "TASK";
export type EdgeKind = "PREREQ_REQUIRED" | "CONTAINS";
export type SlotKind = "CORE" | "METHODS" | "SKILLS" | "TASKS";
export type SlotState = "visible" | "placeholder";
export interface TopicPageNode {
    id: string;
    title: string;
    role: TopicNodeRole;
    isExternal: boolean;
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
export interface RoadmapNode {
    id: string;
    title: string;
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
export interface TopicListItem {
    id: string;
    title: string;
}
export interface StudyPlanItem {
    id: string;
    title: string;
}
export interface CreateNodeDto {
    title: string;
    role: TopicNodeRole;
    parentTopicId?: string;
}
export interface UpdateNodeDto {
    title?: string;
    role?: TopicNodeRole;
}
export interface CreateEdgeDto {
    from: string;
    to: string;
    type: EdgeKind;
}

export type DragKind = "section" | "article" | "paragraph";

export interface DragState {
  isDragging: boolean;
  dragType: DragKind;
  dragIndex: number;
  dragId: string;
  parentId?: string;
}

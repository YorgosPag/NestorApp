import type { ObligationSection } from "@/types/obligations";

export interface SectionEditorProps {
  section: ObligationSection;
  onSave: (section: ObligationSection) => void;
  onDelete?: (sectionId: string) => void;
  onCancel?: () => void;
  isEditing?: boolean;
}

export interface FieldUpdate {
  (field: keyof ObligationSection, value: unknown): void;
}

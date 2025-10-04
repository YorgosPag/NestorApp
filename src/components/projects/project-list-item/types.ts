
import type { Project, ProjectStatus } from "@/types/project";

export interface ProjectListItemProps {
  project: Project;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  companyName: string;
}

export type { Project, ProjectStatus };

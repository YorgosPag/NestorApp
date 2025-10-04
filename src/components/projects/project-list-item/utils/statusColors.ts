
import type { ProjectStatus } from "../types";

const COLORS: Record<ProjectStatus, string> = {
  planning:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_progress:"bg-blue-100 text-blue-800 border-blue-200",
  completed:  "bg-green-100 text-green-800 border-green-200",
  on_hold:    "bg-gray-100 text-gray-800 border-gray-200",
  cancelled:  "bg-red-100 text-red-800 border-red-200",
};

export const getStatusColorClass = (status: ProjectStatus) => COLORS[status];

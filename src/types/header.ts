import type { LucideIcon } from "lucide-react";

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  action: string;
  shortcut: string;
}

export enum NotificationType {
  NEW_CONTACT,
  COMPANY_UPDATE,
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  textColor: string;
}

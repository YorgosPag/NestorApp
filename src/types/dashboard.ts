import type { LucideIcon } from "lucide-react";

export interface Activity {
  id: number;
  type: string;
  title: string;
  description: string;
  time: string;
  icon: LucideIcon;
  color: string;
}

export interface Meeting {
  id: number;
  title: string;
  time: string;
  date: string;
  type: string;
  location: string;
}

export interface QuickStats {
  totalContacts: number;
  newThisMonth: number;
  favorites: number;
  activeToday: number;
}

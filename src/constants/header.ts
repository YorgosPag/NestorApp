import { Users, Building2, Landmark } from "lucide-react"
import type { QuickAction, Notification } from "@/types/header"

// 🌐 i18n: All labels converted to i18n keys - 2026-01-18
// Labels are translated at runtime by components using useTranslation
export const quickActions: QuickAction[] = [
  {
    label: "header.quickActions.newIndividual",
    icon: Users,
    action: "/contacts/new/individual",
    shortcut: "F",
  },
  {
    label: "header.quickActions.newCompany",
    icon: Building2,
    action: "/contacts/new/company",
    shortcut: "E",
  },
  {
    label: "header.quickActions.newService",
    icon: Landmark,
    action: "/contacts/new/service",
    shortcut: "Y",
  },
]

// 🏢 ENTERPRISE: Hardcoded notifications removed - use database queries
export const getNotifications = async (): Promise<Notification[]> => {
  // TODO: Replace with actual database queries using COLLECTIONS constants
  return []; // From database - no hardcoded notifications
};

import { Users, Building2, Landmark, Plus, Building } from "lucide-react"
import type { QuickAction, Notification } from "@/types/header"
import { NotificationType } from "@/types/header"

export const quickActions: QuickAction[] = [
  {
    label: "Νέο Φυσικό Πρόσωπο",
    icon: Users,
    action: "/contacts/new/individual",
    shortcut: "F",
  },
  {
    label: "Νέα Εταιρεία",
    icon: Building2,
    action: "/contacts/new/company",
    shortcut: "E",
  },
  {
    label: "Νέα Υπηρεσία",
    icon: Landmark,
    action: "/contacts/new/service",
    shortcut: "Y",
  },
]

// 🏢 ENTERPRISE: Hardcoded notifications removed - use database queries
export const getNotifications = async (): Promise<Notification[]> => {
  // TODO: Replace with actual database queries
  // const notifications = await db.collection('notifications')
  //   .where('read', '==', false)
  //   .orderBy('createdAt', 'desc')
  //   .limit(10)
  //   .get();

  return []; // From database - no hardcoded notifications
};

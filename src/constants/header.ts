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

export const defaultNotifications: Notification[] = [
  {
    id: 1,
    type: NotificationType.NEW_CONTACT,
    title: "Νέα επαφή προστέθηκε",
    description: "Γιώργος Παπαδόπουλος - πριν 2 λεπτά",
    icon: Plus,
    color: "bg-green-100 dark:bg-green-900",
    textColor: "text-green-600 dark:text-green-400",
  },
  {
    id: 2,
    type: NotificationType.COMPANY_UPDATE,
    title: "Ενημέρωση εταιρείας",
    description: "ΑΒΓΔ Α.Ε. - πριν 1 ώρα",
    icon: Building,
    color: "bg-blue-100 dark:bg-blue-900",
    textColor: "text-blue-600 dark:text-blue-400",
  },
]

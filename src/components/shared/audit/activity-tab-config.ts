/* eslint-disable custom/no-hardcoded-strings, design-system/enforce-semantic-colors */
/**
 * ActivityTab configuration — Action map and filter options
 *
 * Extracted from ActivityTab.tsx per Google SRP (500 line limit).
 *
 * @module components/shared/audit/activity-tab-config
 * @enterprise ADR-195 — Entity Audit Trail, ADR-281 — Soft-Delete
 */

import type React from "react";
import {
  Edit3,
  Trash2,
  Plus,
  Link2,
  Unlink,
  RefreshCw,
  UserPlus,
  UserMinus,
  Mail,
  Receipt,
} from "lucide-react";
import type { AuditAction } from "@/types/audit-trail";

export interface ActionConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
}

export const ACTION_MAP: Record<AuditAction, ActionConfig> = {
  created: {
    icon: Plus,
    label: "Δημιουργία",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  updated: {
    icon: Edit3,
    label: "Ενημέρωση",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  deleted: {
    icon: Trash2,
    label: "Διαγραφή",
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  soft_deleted: {
    icon: Trash2,
    label: "Μεταφορά στον κάδο",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  restored: {
    icon: RefreshCw,
    label: "Επαναφορά από κάδο",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  status_changed: {
    icon: RefreshCw,
    label: "Αλλαγή κατάστασης",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  linked: {
    icon: Link2,
    label: "Σύνδεση",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  unlinked: {
    icon: Unlink,
    label: "Αποσύνδεση",
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-950/30",
  },
  professional_assigned: {
    icon: UserPlus,
    label: "Ανάθεση επαγγελματία",
    color: "text-teal-600",
    bgColor: "bg-teal-50 dark:bg-teal-950/30",
  },
  professional_removed: {
    icon: UserMinus,
    label: "Αφαίρεση επαγγελματία",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
  email_sent: {
    icon: Mail,
    label: "Email εστάλη",
    color: "text-sky-600",
    bgColor: "bg-sky-50 dark:bg-sky-950/30",
  },
  invoice_created: {
    icon: Receipt,
    label: "Δημιουργία παραστατικού",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
};

export const FILTER_OPTIONS: { value: AuditAction | "all"; label: string }[] = [
  { value: "all", label: "Όλα" },
  { value: "updated", label: "Ενημερώσεις" },
  { value: "created", label: "Δημιουργίες" },
  { value: "deleted", label: "Διαγραφές" },
  { value: "status_changed", label: "Κατάσταση" },
  { value: "professional_assigned", label: "Αναθέσεις" },
  { value: "professional_removed", label: "Αφαιρέσεις" },
  { value: "email_sent", label: "Email" },
  { value: "invoice_created", label: "Παραστατικά" },
];

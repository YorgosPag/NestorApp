/**
 * ActivityTab configuration — Action map and filter options
 *
 * Extracted from ActivityTab.tsx per Google SRP (500 line limit).
 * Labels use i18n keys (audit.actions.* / audit.filters.*) resolved at render time.
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
  FilePlus2,
  FileMinus2,
} from "lucide-react";
import type { AuditAction } from "@/types/audit-trail";

export interface ActionConfig {
  icon: React.ComponentType<{ className?: string }>;
  /** i18n key under audit.actions.* — resolved at render time */
  labelKey: string;
  color: string;
  bgColor: string;
}

export const ACTION_MAP: Record<AuditAction, ActionConfig> = {
  created: {
    icon: Plus,
    labelKey: "audit.actions.created",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  updated: {
    icon: Edit3,
    labelKey: "audit.actions.updated",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
  },
  deleted: {
    icon: Trash2,
    labelKey: "audit.actions.deleted",
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
  },
  soft_deleted: {
    icon: Trash2,
    labelKey: "audit.actions.soft_deleted",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  restored: {
    icon: RefreshCw,
    labelKey: "audit.actions.restored",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  status_changed: {
    icon: RefreshCw,
    labelKey: "audit.actions.status_changed",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
  },
  linked: {
    icon: Link2,
    labelKey: "audit.actions.linked",
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
  },
  unlinked: {
    icon: Unlink,
    labelKey: "audit.actions.unlinked",
    color: "text-gray-600",
    bgColor: "bg-gray-50 dark:bg-gray-950/30",
  },
  professional_assigned: {
    icon: UserPlus,
    labelKey: "audit.actions.professional_assigned",
    color: "text-teal-600",
    bgColor: "bg-teal-50 dark:bg-teal-950/30",
  },
  professional_removed: {
    icon: UserMinus,
    labelKey: "audit.actions.professional_removed",
    color: "text-orange-600",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
  },
  email_sent: {
    icon: Mail,
    labelKey: "audit.actions.email_sent",
    color: "text-sky-600",
    bgColor: "bg-sky-50 dark:bg-sky-950/30",
  },
  invoice_created: {
    icon: Receipt,
    labelKey: "audit.actions.invoice_created",
    color: "text-green-600",
    bgColor: "bg-green-50 dark:bg-green-950/30",
  },
  document_added: {
    icon: FilePlus2,
    labelKey: "audit.actions.document_added",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
  },
  document_removed: {
    icon: FileMinus2,
    labelKey: "audit.actions.document_removed",
    color: "text-rose-600",
    bgColor: "bg-rose-50 dark:bg-rose-950/30",
  },
};

/** i18n key under audit.filters.* — resolved at render time */
export const FILTER_OPTIONS: { value: AuditAction | "all"; labelKey: string }[] = [
  { value: "all", labelKey: "audit.filters.all" },
  { value: "updated", labelKey: "audit.filters.updated" },
  { value: "created", labelKey: "audit.filters.created" },
  { value: "deleted", labelKey: "audit.filters.deleted" },
  { value: "status_changed", labelKey: "audit.filters.status_changed" },
  { value: "professional_assigned", labelKey: "audit.filters.professional_assigned" },
  { value: "professional_removed", labelKey: "audit.filters.professional_removed" },
  { value: "email_sent", labelKey: "audit.filters.email_sent" },
  { value: "invoice_created", labelKey: "audit.filters.invoice_created" },
  { value: "document_added", labelKey: "audit.filters.document_added" },
  { value: "document_removed", labelKey: "audit.filters.document_removed" },
];

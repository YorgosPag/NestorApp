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
  AlertTriangle,
  Send,
  Check,
  X,
  Eraser,
  Flag,
  UserCheck,
  StickyNote,
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
    color: "text-[hsl(var(--text-success))]",
    bgColor: "bg-[hsl(var(--bg-success))]/10",
  },
  updated: {
    icon: Edit3,
    labelKey: "audit.actions.updated",
    color: "text-primary",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  deleted: {
    icon: Trash2,
    labelKey: "audit.actions.deleted",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  soft_deleted: {
    icon: Trash2,
    labelKey: "audit.actions.soft_deleted",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  restored: {
    icon: RefreshCw,
    labelKey: "audit.actions.restored",
    color: "text-[hsl(var(--text-success))]",
    bgColor: "bg-[hsl(var(--bg-success))]/10",
  },
  status_changed: {
    icon: RefreshCw,
    labelKey: "audit.actions.status_changed",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  linked: {
    icon: Link2,
    labelKey: "audit.actions.linked",
    color: "text-primary",
    bgColor: "bg-accent",
  },
  unlinked: {
    icon: Unlink,
    labelKey: "audit.actions.unlinked",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  professional_assigned: {
    icon: UserPlus,
    labelKey: "audit.actions.professional_assigned",
    color: "text-primary",
    bgColor: "bg-accent",
  },
  professional_removed: {
    icon: UserMinus,
    labelKey: "audit.actions.professional_removed",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  email_sent: {
    icon: Mail,
    labelKey: "audit.actions.email_sent",
    color: "text-primary",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  invoice_created: {
    icon: Receipt,
    labelKey: "audit.actions.invoice_created",
    color: "text-[hsl(var(--text-success))]",
    bgColor: "bg-[hsl(var(--bg-success))]/10",
  },
  document_added: {
    icon: FilePlus2,
    labelKey: "audit.actions.document_added",
    color: "text-primary",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  document_removed: {
    icon: FileMinus2,
    labelKey: "audit.actions.document_removed",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  vendor_notified: {
    icon: Mail,
    labelKey: "audit.actions.vendor_notified",
    color: "text-primary",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  orphaned: {
    icon: AlertTriangle,
    labelKey: "audit.actions.orphaned",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  auto_submit_prompted: {
    icon: Send,
    labelKey: "audit.actions.auto_submit_prompted",
    color: "text-primary",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  auto_submit_accepted: {
    icon: Check,
    labelKey: "audit.actions.auto_submit_accepted",
    color: "text-[hsl(var(--text-success))]",
    bgColor: "bg-[hsl(var(--bg-success))]/10",
  },
  auto_submit_declined: {
    icon: X,
    labelKey: "audit.actions.auto_submit_declined",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  erased: {
    icon: Eraser,
    labelKey: "audit.actions.erased",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  triage_status_changed: {
    icon: Flag,
    labelKey: "audit.actions.triage_status_changed",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  triage_assigned: {
    icon: UserCheck,
    labelKey: "audit.actions.triage_assigned",
    color: "text-primary",
    bgColor: "bg-accent",
  },
  internal_note_added: {
    icon: StickyNote,
    labelKey: "audit.actions.internal_note_added",
    color: "text-primary",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
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

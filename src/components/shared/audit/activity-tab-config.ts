/**
 * ActivityTab configuration — Action map (icon · label · colour · filter category per action)
 *
 * Extracted from ActivityTab.tsx per Google SRP (500 line limit).
 * Labels use i18n keys (audit.actions.*) resolved at render time. Each action declares its filter
 * category; the chips themselves live in `audit-filter-categories.ts`.
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
  FileDown,
  Lock,
  FileX,
  Share2,
  ShieldOff,
} from "lucide-react";
import type { AuditAction } from "@/types/audit-trail";
import type { AuditFilterCategory } from "./audit-filter-categories";

export interface ActionConfig {
  icon: React.ComponentType<{ className?: string }>;
  /** i18n key under audit.actions.* — resolved at render time */
  labelKey: string;
  /**
   * Σε ποιο chip του Ιστορικού ανήκει — **ακριβώς ένα** (`audit-filter-categories.ts`). Υποχρεωτικό: νέα ενέργεια
   * χωρίς κατηγορία δεν μεταγλωττίζεται, άρα δεν μπορεί να μείνει γραμμή που κανένα φίλτρο δεν δείχνει.
   */
  category: AuditFilterCategory;
  color: string;
  bgColor: string;
}

export const ACTION_MAP: Record<AuditAction, ActionConfig> = {
  created: {
    icon: Plus,
    labelKey: "audit.actions.created",
    category: "created",
    color: "text-[hsl(var(--text-success))]",
    bgColor: "bg-[hsl(var(--bg-success))]/10",
  },
  updated: {
    icon: Edit3,
    labelKey: "audit.actions.updated",
    category: "changed",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  deleted: {
    icon: Trash2,
    labelKey: "audit.actions.deleted",
    category: "deleted",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  soft_deleted: {
    icon: Trash2,
    labelKey: "audit.actions.soft_deleted",
    category: "deleted",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  restored: {
    icon: RefreshCw,
    labelKey: "audit.actions.restored",
    category: "changed",
    color: "text-[hsl(var(--text-success))]",
    bgColor: "bg-[hsl(var(--bg-success))]/10",
  },
  status_changed: {
    icon: RefreshCw,
    labelKey: "audit.actions.status_changed",
    category: "changed",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  linked: {
    icon: Link2,
    labelKey: "audit.actions.linked",
    category: "changed",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-accent",
  },
  unlinked: {
    icon: Unlink,
    labelKey: "audit.actions.unlinked",
    category: "changed",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  professional_assigned: {
    icon: UserPlus,
    labelKey: "audit.actions.professional_assigned",
    category: "access",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-accent",
  },
  professional_removed: {
    icon: UserMinus,
    labelKey: "audit.actions.professional_removed",
    category: "access",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  email_sent: {
    icon: Mail,
    labelKey: "audit.actions.email_sent",
    category: "communication",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  invoice_created: {
    icon: Receipt,
    labelKey: "audit.actions.invoice_created",
    category: "created",
    color: "text-[hsl(var(--text-success))]",
    bgColor: "bg-[hsl(var(--bg-success))]/10",
  },
  document_added: {
    icon: FilePlus2,
    labelKey: "audit.actions.document_added",
    category: "created",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  document_removed: {
    icon: FileMinus2,
    labelKey: "audit.actions.document_removed",
    category: "deleted",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  vendor_notified: {
    icon: Mail,
    labelKey: "audit.actions.vendor_notified",
    category: "communication",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  orphaned: {
    icon: AlertTriangle,
    labelKey: "audit.actions.orphaned",
    category: "changed",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  auto_submit_prompted: {
    icon: Send,
    labelKey: "audit.actions.auto_submit_prompted",
    category: "communication",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  auto_submit_accepted: {
    icon: Check,
    labelKey: "audit.actions.auto_submit_accepted",
    category: "changed",
    color: "text-[hsl(var(--text-success))]",
    bgColor: "bg-[hsl(var(--bg-success))]/10",
  },
  auto_submit_declined: {
    icon: X,
    labelKey: "audit.actions.auto_submit_declined",
    category: "changed",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  erased: {
    icon: Eraser,
    labelKey: "audit.actions.erased",
    category: "deleted",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  triage_status_changed: {
    icon: Flag,
    labelKey: "audit.actions.triage_status_changed",
    category: "changed",
    color: "text-[hsl(var(--text-warning))]",
    bgColor: "bg-[hsl(var(--bg-warning))]/40",
  },
  triage_assigned: {
    icon: UserCheck,
    labelKey: "audit.actions.triage_assigned",
    category: "changed",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-accent",
  },
  internal_note_added: {
    icon: StickyNote,
    labelKey: "audit.actions.internal_note_added",
    category: "communication",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  document_accessed: {
    icon: FileDown,
    labelKey: "audit.actions.document_accessed",
    category: "viewed",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  evidence_retention_scheduled: {
    icon: Lock,
    labelKey: "audit.actions.evidence_retention_scheduled",
    category: "changed",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  evidence_disposed: {
    icon: FileX,
    labelKey: "audit.actions.evidence_disposed",
    category: "deleted",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  // ADR-901 Φ4.5 — «Ζήτησε έγγραφο»: επικοινωνία (ίδια οικογένεια με το «email_sent»), όχι αλλαγή.
  document_requested: {
    icon: Send,
    labelKey: "audit.actions.document_requested",
    category: "communication",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  // ADR-942 Φ2 — ο κάτοχος έδωσε / ανακάλεσε την ανάγνωση ενός αρχείου σε επαγγελματία (το «Shared» του Drive).
  document_shared: {
    icon: Share2,
    labelKey: "audit.actions.document_shared",
    category: "access",
    color: "text-[hsl(var(--text-info))]",
    bgColor: "bg-[hsl(var(--bg-info))]/20",
  },
  document_unshared: {
    icon: ShieldOff,
    labelKey: "audit.actions.document_unshared",
    category: "access",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
};

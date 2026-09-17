"use client";

/**
 * Μικρά κοινά κομμάτια του χρονολογίου ιστορικού — φίλτρο-chip και διαχωριστής ημέρας.
 *
 * SSoT: ζούσαν αντιγραμμένα σε `AuditTimelineView` **και** `ContactHistoryTab`, με τα ίδια
 * δύο λάθη (ADR-770 §18):
 *  · Ενεργό chip = `bg-primary` ⇒ στο σκοτεινό ΙΔΙΟ με την κάρτα: το «Όλα» δεν φαινόταν
 *    επιλεγμένο. Ένα φίλτρο-chip ΕΙΝΑΙ χειριστήριο επιλογής ⇒ ρόλος `--control-*` (§17).
 *  · Αριθμός 10px με `opacity-50` και ημερομηνία 11px — κάτω από το ελάχιστο 12px
 *    (GitHub Primer), και η αδιαφάνεια κόβει την αντίθεση που το token εγγυάται.
 *
 * @enterprise ADR-195 — Entity Audit Trail · ADR-770 §17/§18
 */

import { cn } from "@/lib/utils";

export interface AuditFilterChipProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

export function AuditFilterChip({ label, count, isActive, onClick }: AuditFilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        isActive
          ? "bg-control-accent text-control-accent-foreground"
          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export function AuditDayDivider({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 py-1 backdrop-blur-sm">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

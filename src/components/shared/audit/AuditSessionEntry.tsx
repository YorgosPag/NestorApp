/**
 * 📜 AuditSessionEntry — μια **συνεδρία επεξεργασίας** στο χρονολόγιο
 *
 * Συνεδρία μίας εγγραφής ⇒ η εγγραφή όπως πάντα. Περισσότερων ⇒ **μία** γραμμή με την καθαρή
 * αλλαγή (`coalesce-edit-sessions.ts`), και από κάτω οι επιμέρους αποθηκεύσεις, κλειστές: το
 * ιστορικό λέει πρώτα *τι άλλαξε τελικά* και μόνο αν ρωτηθεί *πώς έφτασε εκεί*.
 *
 * @module components/shared/audit/AuditSessionEntry
 * @enterprise ADR-195 — Entity Audit Trail
 */

"use client";

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from "react";
import { formatDateTime } from "@/lib/intl-utils";
import type { AuditSession } from "@/services/audit/coalesce-edit-sessions";
import { useTranslation } from "@/i18n/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { useSemanticColors } from "@/ui-adapters/react/useSemanticColors";
import { AuditTimelineEntry } from "./audit-timeline-entry";

interface AuditSessionEntryProps {
  session: AuditSession;
  showEntityLink: boolean;
}

/** Η ώρα της πρώτης και της τελευταίας αποθήκευσης — ανεξάρτητα από τη σειρά των εγγραφών. */
function sessionSpan(session: AuditSession): { from: string; to: string } {
  const times = session.entries.map((entry) => Date.parse(entry.timestamp));
  const clock = (ms: number) => formatDateTime(new Date(ms), { timeStyle: 'short' });
  return { from: clock(Math.min(...times)), to: clock(Math.max(...times)) };
}

export function AuditSessionEntry({ session, showEntityLink }: AuditSessionEntryProps) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  const colors = useSemanticColors();

  if (session.entries.length === 1) {
    return <AuditTimelineEntry entry={session.net} showEntityLink={showEntityLink} />;
  }

  return (
    <AuditTimelineEntry entry={session.net} showEntityLink={showEntityLink}>
      {session.net.changes.length === 0 && (
        <p className={cn("mt-1.5 text-xs", colors.text.muted)}>{t("audit.session.noNetChange")}</p>
      )}
      <details className="mt-1.5 text-xs">
        <summary className={cn("cursor-pointer select-none", colors.text.muted)}>
          {t("audit.session.saves", { count: session.entries.length, ...sessionSpan(session) })}
        </summary>
        <ol className="relative ml-3 mt-2 border-l-2 border-muted">
          {session.entries.map((entry) => (
            <AuditTimelineEntry key={entry.id} entry={entry} showEntityLink={false} />
          ))}
        </ol>
      </details>
    </AuditTimelineEntry>
  );
}

/**
 * Contact Unified History — Types
 *
 * Discriminated union and supporting types for the unified contact timeline
 * that merges audit trail entries with photo share records.
 *
 * @module components/contacts/tabs/contact-history-types
 */

import type { EntityAuditEntry, AuditAction } from '@/types/audit-trail';
import type { PhotoShareRecord } from '@/types/photo-share';

// ============================================================================
// DISCRIMINATED UNION
// ============================================================================

export type ContactTimelineEntry =
  | { kind: 'audit'; timestamp: Date; entry: EntityAuditEntry }
  | { kind: 'photo_share'; timestamp: Date; entry: PhotoShareRecord };

// ============================================================================
// FILTER TYPE
// ============================================================================

export type ContactHistoryFilter = AuditAction | 'photo_share' | 'all';

// ============================================================================
// GROUPED TIMELINE
// ============================================================================

export interface GroupedTimelineDay {
  dateLabel: string;
  dateKey: string;
  entries: ContactTimelineEntry[];
}

// ============================================================================
// EXTENDED STATS
// ============================================================================

export interface ContactHistoryStats {
  total: number;
  auditCount: number;
  photoShareCount: number;
  byAction: Partial<Record<AuditAction, number>>;
  /**
   * Η στιγμή της τελευταίας αλλαγής — **όχι** έτοιμο κείμενο: το «πριν από 4 λεπτά» το γράφει το `AuditStatsPanel` κατά
   * την απόδοση, στη γλώσσα της στιγμής. Ψημένο εδώ, μέσα σε `useMemo([entries])`, έμενε στη γλώσσα που υπολογίστηκε.
   */
  lastChangeAt: Date | null;
  uniqueFieldsChanged: number;
  uniqueUsers: number;
}

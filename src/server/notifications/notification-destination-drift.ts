/**
 * =============================================================================
 * ΑΝΙΧΝΕΥΤΗΣ ΑΠΟΚΛΙΣΗΣ ΠΡΟΟΡΙΣΜΩΝ — η ΚΡΙΣΗ (ADR-849 §6δ Β2)
 * =============================================================================
 *
 * «Ο προορισμός που **αποθηκεύτηκε** σε αυτή την ειδοποίηση είναι αυτός που θα έγραφε
 * **σήμερα** ο παραγωγός της;» — καθαρό, χωρίς βάση, χωρίς δίκτυο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΠΡΟΛΗΠΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 14 ειδοποιήσεις ζήτησης στη βάση (2026-09-11): **5** κρατούσαν `/offers/prop_*` — την
 * πόρτα του **ιδιώτη** για ακίνητο **γραφείου**, γραμμένη πριν το ADR-841 Α18.9 — και
 * **καμία** από τις 27 με σύνδεσμο δεν είχε χώρο-στόχο (πριν το Β1). Η διόρθωση του
 * παραγωγού σώζει τις **επόμενες**· τις **υπάρχουσες** τις σώζει μόνο αυτός ο ανιχνευτής.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΟΧΙ «ΛΥΣΗ ΤΗ ΣΤΙΓΜΗ ΤΟΥ ΚΛΙΚ» (το μοντέλο του GitHub)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Θα ήταν δεύτερη αυθεντία προορισμού στο `/n/{id}` — και θα **έκρυβε** το λάθος του
 * παραγωγού αντί να το **αναφέρει**: ένας παραγωγός που αύριο γράφει λάθος πόρτα θα
 * «δούλευε», και κανείς δεν θα το μάθαινε. Εδώ η απόκλιση **τυπώνεται** και διορθώνεται
 * **ρητά**, με έγκριση ανθρώπου, από τον **ίδιο** κανόνα που χρησιμοποιεί ο παραγωγός.
 *
 * @module server/notifications/notification-destination-drift
 * @see server/notifications/notification-destination-rules — οι κανόνες ανά τύπο (I/O)
 * @see scripts/notifications/destination-drift.ts — η εκτέλεση
 */

import {
  firstActionUrl,
  readDestinationWorkspace,
  type DestinationAction,
  type NotificationDestination,
} from '@/lib/notifications/notification-destination';
import { workspaceRefKey, type WorkspaceRef } from '@/types/workspace-membership';

/** Ό,τι κοιτάζει ο ανιχνευτής σε ένα έγγραφο ειδοποίησης **με** προορισμό. */
export interface StoredNotification {
  readonly id: string;
  readonly userId: string;
  readonly eventType: string;
  readonly entityId: string | null;
  readonly url: string;
  /** Ξανακριμένος (`readDestinationWorkspace`): αλλοιωμένος χώρος ⇒ `null` ⇒ απόκλιση. */
  readonly workspace: WorkspaceRef | null;
}

/** Γιατί ένας προορισμός **δεν** μπορεί να ξαναχτιστεί. Κλειστό σύνολο, ποτέ ελεύθερο κείμενο. */
export type UnresolvableReason =
  /** Ο τύπος δεν έχει κανόνα — **δηλώνεται**, δεν μαντεύεται. */
  | 'no-rule'
  /** Η ειδοποίηση δεν ονομάζει οντότητα (`meta.entityId`). */
  | 'no-entity'
  /** Η οντότητα δεν υπάρχει πια. */
  | 'entity-absent'
  /** Ακίνητο γραφείου χωρίς εταιρεία — δεν έχει χώρο, άρα ούτε πόρτα. */
  | 'unscoped';

export type ExpectedDestination =
  | { readonly kind: 'expected'; readonly destination: NotificationDestination }
  | { readonly kind: 'unresolvable'; readonly reason: UnresolvableReason };

/** Η αλλαγή που θα έγραφε το `--apply` — **μόνο** τα πεδία που αποκλίνουν. */
export interface DriftPatch {
  readonly actions?: readonly DestinationAction[];
  readonly 'meta.workspace'?: WorkspaceRef;
}

export interface DriftChange<T> {
  readonly stored: T;
  readonly expected: T;
}

export type DriftVerdict =
  | { readonly kind: 'aligned' }
  | {
      readonly kind: 'drift';
      readonly url: DriftChange<string> | null;
      readonly workspace: DriftChange<WorkspaceRef | null> | null;
      readonly patch: DriftPatch;
    }
  | { readonly kind: 'unresolvable'; readonly reason: UnresolvableReason };

type Fields = Readonly<Record<string, unknown>>;

function fieldsOf(value: unknown): Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : {};
}

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * **Έγγραφο → ό,τι κρίνεται**, ή `null` όταν η ειδοποίηση **δεν έχει** προορισμό (δεν
 * αφορά τον ανιχνευτή: χωρίς κουμπί δεν υπάρχει πόρτα να αποκλίνει).
 */
export function storedNotificationOf(id: string, data: unknown): StoredNotification | null {
  const doc = fieldsOf(data);
  const meta = fieldsOf(doc.meta);
  const userId = textOf(doc.userId);
  const url = textOf(firstActionUrl(doc.actions));
  if (userId === null || url === null) return null;

  return {
    id,
    userId,
    eventType: textOf(meta.eventType) ?? '',
    entityId: textOf(meta.entityId),
    url,
    workspace: readDestinationWorkspace(meta.workspace, userId),
  };
}

function sameWorkspace(stored: WorkspaceRef | null, expected: WorkspaceRef): boolean {
  return stored !== null && workspaceRefKey(stored) === workspaceRefKey(expected);
}

/**
 * **Αποκλίνει ο αποθηκευμένος προορισμός από τον σημερινό κανόνα του παραγωγού;**
 *
 * ⚠️ **Ιδεμποτές εκ κατασκευής**: το `patch` φέρνει το έγγραφο **ακριβώς** στον
 * αναμενόμενο προορισμό, άρα το επόμενο πέρασμα απαντά `aligned` — ποτέ δεύτερη εγγραφή.
 */
export function destinationDrift(
  stored: StoredNotification,
  expected: ExpectedDestination,
): DriftVerdict {
  if (expected.kind === 'unresolvable') return expected;

  const target = expected.destination;
  const expectedUrl = textOf(firstActionUrl(target.actions));
  const urlDrifts = expectedUrl !== null && stored.url !== expectedUrl;
  const workspaceDrifts = !sameWorkspace(stored.workspace, target.workspace);
  if (!urlDrifts && !workspaceDrifts) return { kind: 'aligned' };

  return {
    kind: 'drift',
    url: urlDrifts && expectedUrl !== null ? { stored: stored.url, expected: expectedUrl } : null,
    workspace: workspaceDrifts ? { stored: stored.workspace, expected: target.workspace } : null,
    patch: {
      ...(urlDrifts ? { actions: target.actions } : {}),
      ...(workspaceDrifts ? { 'meta.workspace': target.workspace } : {}),
    },
  };
}

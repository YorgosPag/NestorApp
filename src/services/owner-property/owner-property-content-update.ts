/**
 * @fileoverview **Η αποθήκευση περιεχομένου μιας αγγελίας** — γράφεται μόνο ό,τι άλλαξε ο άνθρωπος, πάνω στο φρέσκο
 * έγγραφο· σύγκρουση μόνο όταν δύο άλλαξαν το ίδιο πεδίο σε άλλη τιμή.
 * @related ADR-953 §3.4 · lib/owner-property/owner-property-edit.ts (η καθαρή συγχώνευση) ·
 *   owner-property-amendment.ts (η ΜΙΑ συναλλαγή) · owner-property-write.service.ts (`updateOwnerProperty`, ο καλών)
 * @module services/owner-property/owner-property-content-update
 *
 * 🔴 **ΗΤΑΝ «ΔΙΑΒΑΣΕ, ΜΕΤΑ `set` ΟΛΟΚΛΗΡΟΥ»** ως τις 2026-11-28: η ανάγνωση γινόταν εκτός συναλλαγής και το
 * προσχέδιο ήταν **και τα 15 πεδία** όπως τα είχε η φόρμα όταν άνοιξε. Παλιά καρτέλα έσβηνε ό,τι άλλαξε άλλος στο
 * μεταξύ, και κάθε πράξη που έγραφε ανάμεσα στην ανάγνωση και το `set` χανόταν.
 *
 * 🔑 **ΚΑΜΙΑ ΔΕΥΤΕΡΗ ΣΥΝΑΛΛΑΓΗ ΕΔΩ.** Το σχήμα «φρέσκο έγγραφο → θεματοφυλακή → κρίση → `set` → ίχνος → επαναπροβολή»
 * υπάρχει **μία** φορά, στο {@link amendOwnerProperty}· εδώ ζει **μόνο** η κρίση: τι γράφεται, ή γιατί όχι. Δεύτερο
 * αντίγραφο της συναλλαγής θα ήταν δεύτερος γραφέας της συλλογής — και το μέτρησε η CHECK 3.17 την ημέρα που γράφτηκε.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { ListingActor } from '@/lib/owner-property/listing-custody';
import {
  draftFieldsOf,
  mergeOwnerPropertyEdit,
  type OwnerPropertyEdit,
} from '@/lib/owner-property/owner-property-edit';
import { createModuleLogger } from '@/lib/telemetry';
import { resolveUserDisplayName } from '@/services/entity-audit.service';
import {
  amendOwnerProperty,
  type OwnerPropertyAmendment,
} from '@/services/owner-property/owner-property-amendment';
import type { OwnerPropertyWriteResult } from '@/services/owner-property/owner-property-write-result';
import type { OwnerProperty, OwnerPropertyDraft } from '@/types/owner-property';
import { ownerPropertyInvariantViolations } from '@/types/owner-property-invariants';

const logger = createModuleLogger('owner-property-content-update');

interface OwnerPropertyContentUpdateInput {
  readonly ownerPropertyId: string;
  readonly draft: OwnerPropertyDraft;
  /**
   * Τι δηλώνει η φόρμα ότι άλλαξε. `null` = καρτέλα ανοιχτή από **πριν** το ADR-953: γράφονται όλα τα πεδία της,
   * όπως πριν, αλλά μέσα στη συναλλαγή (ADR-953 §3.2 — άρνηση θα έχανε τη δουλειά ανθρώπου που δεν φταίει).
   */
  readonly edit: OwnerPropertyEdit | null;
  readonly actor: ListingActor;
}

/**
 * Το προσχέδιο που θα γραφτεί πάνω στο φρέσκο έγγραφο — ή τα πεδία που συγκρούονται.
 * `written: null` = χωρίς `_edit`: δεν ξέρουμε τι άλλαξε, άρα θεωρείται ότι γράφτηκε περιεχόμενο.
 */
function resolveDraft(existing: OwnerProperty, draft: OwnerPropertyDraft, edit: OwnerPropertyEdit | null) {
  if (edit === null) return { kind: 'merged', draft, written: null } as const;
  return mergeOwnerPropertyEdit(draftFieldsOf(existing), existing.contentEdit?.at ?? null, draft, edit);
}

/**
 * **Η κρίση πάνω στο φρέσκο έγγραφο**: σύγκρουση · άκυρο συγχωνευμένο · ή τα πεδία που γράφονται.
 *
 * ⚠️ Καθαρή — η συναλλαγή μπορεί να την ξανατρέξει. Το όνομα του «ποιος» **δεν** λύνεται εδώ (ανάγνωση άλλου
 * εγγράφου μέσα στη συναλλαγή)· η σύγκρουση φεύγει με `byName: null` και συμπληρώνεται μετά.
 */
function judgeContentUpdate(
  existing: OwnerProperty,
  at: string,
  { draft, edit, actor }: OwnerPropertyContentUpdateInput,
): OwnerPropertyAmendment {
  const merge = resolveDraft(existing, draft, edit);
  if (merge.kind === 'conflict') {
    const stamp = existing.contentEdit;
    return {
      kind: 'refuse',
      result: { kind: 'conflict', fields: merge.fields, at: stamp?.at ?? null, bySelf: stamp?.by === actor.uid, byName: null },
    };
  }
  // 🔴 Κρίνεται το **συγχωνευμένο**: δύο έγκυρες αλλαγές σε διαφορετικά πεδία μπορούν να δώσουν άκυρη αγγελία.
  const violations = ownerPropertyInvariantViolations(merge.draft);
  if (violations.length > 0) return { kind: 'refuse', result: { kind: 'invalid', violations } };

  // 🔑 Η έκδοση περιεχομένου ανεβαίνει **μόνο** όταν γράφτηκε περιεχόμενο: αποθήκευση που δεν άλλαξε τίποτα δεν
  //    επιτρέπεται να εμφανιστεί στον άλλον ως «κάποιος έγραψε στο μεταξύ».
  const wrote = merge.written === null || merge.written.length > 0;
  return {
    kind: 'amend',
    fields: { ...draftFieldsOf(merge.draft), ...(wrote ? { contentEdit: { at, by: actor.uid } } : {}) },
  };
}

/**
 * **Αποθήκευση περιεχομένου** σε υπάρχουσα αγγελία.
 *
 * ⚠️ Το όνομα του «ποιος» λύνεται **μετά** τη συναλλαγή και **μόνο** σε σύγκρουση: η επιτυχής αποθήκευση δεν το
 * πληρώνει. Η ταυτότητα κρατιέται από την **τελευταία** εκτέλεση της κρίσης (η συναλλαγή μπορεί να ξανατρέξει).
 */
export async function updateOwnerPropertyContent(
  adminDb: AdminFirestore,
  input: OwnerPropertyContentUpdateInput,
): Promise<OwnerPropertyWriteResult> {
  if (input.edit === null) {
    logger.warn('Αποθήκευση αγγελίας χωρίς `_edit` — γράφονται όλα τα πεδία (καρτέλα πριν το ADR-953)', {
      data: { ownerPropertyId: input.ownerPropertyId },
    });
  }

  const seen: { editor: string | null } = { editor: null };
  const result = await amendOwnerProperty(adminDb, {
    ownerPropertyId: input.ownerPropertyId,
    actor: input.actor,
    amend: (existing, at) => {
      seen.editor = existing.contentEdit?.by ?? null;
      return judgeContentUpdate(existing, at, input);
    },
    failureMessage: 'Η αγγελία δεν αποθηκεύτηκε',
    logger,
  });

  if (result.kind !== 'conflict' || result.bySelf || seen.editor === null) return result;
  return { ...result, byName: await resolveUserDisplayName(seen.editor, null) };
}

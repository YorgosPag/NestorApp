'use client';

/**
 * @fileoverview **Η αποθήκευση μιας ΕΠΕΞΕΡΓΑΣΙΑΣ αγγελίας** — τι άλλαξα σε σχέση με ό,τι φόρτωσα, και τι γίνεται
 * όταν κάποιος άλλαξε το ίδιο πεδίο στο μεταξύ.
 * @related ADR-953 §3.2 · §3.5 · lib/owner-property/owner-property-edit.ts ·
 *   components/owner-property/form/OwnerListingConflictDialog.tsx
 * @module hooks/owner-property/useOwnerListingEdit
 *
 * 🔴 **Η ΒΑΣΗ ΠΑΓΩΝΕΙ ΣΤΟ ΑΝΟΙΓΜΑ ΤΗΣ ΦΟΡΜΑΣ.** Ο φορέας ξαναδίνει `initialValues` σε κάθε απόδοση (το έγγραφο
 * είναι ζωντανό)· η φόρμα όμως δείχνει ό,τι είχε όταν άνοιξε. «Τι άλλαξα» σημαίνει «σε σχέση με αυτό που **είδα**»
 * — βάση που ακολουθεί το ζωντανό έγγραφο θα έκανε κάθε ξένη αλλαγή να φαίνεται δική μου, και θα την έσβηνε.
 *
 * 🔑 **Η ίδια ιδιότητα έχει λοιπόν δύο ρόλους**: η τιμή της στο άνοιγμα είναι η **βάση**, η τρέχουσα τιμή της είναι
 * το **φρέσκο έγγραφο** — από εκεί παίρνει η φόρμα τις τιμές του άλλου στο «Φόρτωσε τις νέες».
 */

import * as React from 'react';
import type { UseFormReturn } from 'react-hook-form';

import {
  OWNER_PROPERTY_DRAFT_FIELDS,
  ownerPropertyEditOf,
  type OwnerListingConflict,
  type OwnerPropertyDraftField,
  type OwnerPropertyEdit,
} from '@/lib/owner-property/owner-property-edit';
import { withServerFormFields } from '@/lib/owner-property/owner-property-form-fields';
import {
  ownerPropertyDraftFrom,
  ownerPropertyFormSchema,
  type OwnerPropertyFormValues,
} from '@/lib/owner-property/owner-property-form-values';
import {
  updateOwnerListing,
  type OwnerListingUpdateResult,
} from '@/services/owner-property/owner-property.service';
import type { OwnerPropertyDraft } from '@/types/owner-property';
import type { PropertyOffer } from '@/types/property-offers';

interface OwnerListingEditInput {
  /** Οι τιμές του εγγράφου ως φόρμα — στο άνοιγμα γίνονται **βάση**, μετά είναι το **φρέσκο** έγγραφο. */
  readonly initialValues: OwnerPropertyFormValues;
  /** Οι υπάρχουσες διαθέσεις — η βάση χρειάζεται τις **ίδιες** ταυτότητες `offr_*` με το έγγραφο. */
  readonly previousOffers: readonly PropertyOffer[];
  /** Το `contentEdit.at` του εγγράφου που φόρτωσε η φόρμα· `null` = έγγραφο χωρίς σφραγίδα. */
  readonly baseContentAt: string | null;
  readonly form: UseFormReturn<OwnerPropertyFormValues>;
}

/** Η σύγκρουση που περιμένει απόφαση — μαζί με το προσχέδιο που την προκάλεσε. */
interface PendingConflict {
  readonly ownerPropertyId: string;
  readonly draft: OwnerPropertyDraft;
  readonly conflict: OwnerListingConflict;
}

interface OwnerListingEdit {
  /** Αποθηκεύει **μόνο** ό,τι άλλαξε· σε σύγκρουση ανοίγει τον διάλογο και επιστρέφει `conflict`. */
  readonly save: (ownerPropertyId: string, draft: OwnerPropertyDraft) => Promise<OwnerListingUpdateResult>;
  /** Η σύγκρουση που περιμένει απόφαση, αλλιώς `null`. */
  readonly conflict: OwnerListingConflict | null;
  /** «Κράτα τις δικές μου» — ξαναστέλνει το ίδιο προσχέδιο· `null` αν δεν εκκρεμεί σύγκρουση. */
  readonly keepMine: () => Promise<OwnerListingUpdateResult | null>;
  /** «Φόρτωσε τις νέες» — τα συγκρουόμενα πεδία παίρνουν την τιμή του διακομιστή· τα υπόλοιπα μένουν. */
  readonly takeTheirs: () => void;
  /** Κλείνει τον διάλογο χωρίς απόφαση — τίποτα δεν χάνεται, η επόμενη αποθήκευση θα ξαναρωτήσει. */
  readonly dismiss: () => void;
}

/**
 * Το προσχέδιο-βάση, από την **ίδια** μηχανή που παράγει και το προσχέδιο της φόρμας.
 * `null` όταν οι τιμές του εγγράφου δεν περνούν το σχήμα της φόρμας — τότε δεν υπάρχει βάση να συγκριθεί.
 */
function baseDraftOf(values: OwnerPropertyFormValues, previous: readonly PropertyOffer[]): OwnerPropertyDraft | null {
  const parsed = ownerPropertyFormSchema.safeParse(values);
  if (!parsed.success) return null;
  // ⚠️ Η βάση έχει **μόνο** υπάρχουσες διαθέσεις, άρα η γεννήτρια δεν καλείται· αν κληθεί, η κενή ταυτότητα
  //    κάνει τη διάθεση «αλλαγμένη» — η ασφαλής κατεύθυνση.
  return ownerPropertyDraftFrom(parsed.data, { previous, mintOfferId: () => '' });
}

/**
 * Το `_edit` της αποθήκευσης. Χωρίς βάση ⇒ **όλα** τα πεδία δηλώνονται αλλαγμένα με κενή βάση: ο διακομιστής θα
 * ρωτήσει για κάθε πεδίο που έγραψε άλλος, αντί να το σβήσει σιωπηλά.
 */
function editOf(
  baseDraft: OwnerPropertyDraft | null,
  draft: OwnerPropertyDraft,
  baseContentAt: string | null,
  keepMine: readonly OwnerPropertyDraftField[],
): OwnerPropertyEdit {
  if (baseDraft !== null) return ownerPropertyEditOf(baseDraft, draft, baseContentAt, keepMine);
  return { baseContentAt, changed: OWNER_PROPERTY_DRAFT_FIELDS, base: {}, keepMine };
}

export function useOwnerListingEdit({
  initialValues,
  previousOffers,
  baseContentAt,
  form,
}: OwnerListingEditInput): OwnerListingEdit {
  // 🔑 Αρχικοποιητής-συνάρτηση: η βάση υπολογίζεται **μία** φορά, στο άνοιγμα — δες την κεφαλίδα.
  const [base] = React.useState(() => ({
    draft: baseDraftOf(initialValues, previousOffers),
    contentAt: baseContentAt,
  }));
  const [pending, setPending] = React.useState<PendingConflict | null>(null);

  const send = React.useCallback(
    async (
      ownerPropertyId: string,
      draft: OwnerPropertyDraft,
      keep: readonly OwnerPropertyDraftField[],
    ): Promise<OwnerListingUpdateResult> => {
      const result = await updateOwnerListing(ownerPropertyId, draft, editOf(base.draft, draft, base.contentAt, keep));
      setPending(result.kind === 'conflict' ? { ownerPropertyId, draft, conflict: result.conflict } : null);
      return result;
    },
    [base],
  );

  const save = React.useCallback(
    (ownerPropertyId: string, draft: OwnerPropertyDraft) => send(ownerPropertyId, draft, []),
    [send],
  );

  const keepMine = React.useCallback(
    async () => (pending === null ? null : send(pending.ownerPropertyId, pending.draft, pending.conflict.fields)),
    [pending, send],
  );

  const takeTheirs = React.useCallback(() => {
    if (pending === null) return;
    // ⚠️ `keepDefaultValues`: η φόρμα αλλάζει τιμές, όχι σημείο αναφοράς — η βάση της σύγκρισης μένει παγωμένη.
    form.reset(withServerFormFields(form.getValues(), initialValues, pending.conflict.fields), {
      keepDefaultValues: true,
    });
    setPending(null);
  }, [pending, form, initialValues]);

  const dismiss = React.useCallback(() => setPending(null), []);

  return { save, conflict: pending?.conflict ?? null, keepMine, takeTheirs, dismiss };
}

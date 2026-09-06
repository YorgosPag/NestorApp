'use client';

/**
 * @fileoverview **Η ΠΡΑΞΗ ΤΗΣ ΚΑΤΟΨΗΣ** — «να φύγει ως κάτοψη της αγγελίας» (Α17.7).
 * @related ADR-841 §7 (Α17.7) · hooks/listings/useDeclaredFileIds · agency-media-publication
 * @module hooks/listings/useListingFloorplans
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΥΤΗ Η ΠΡΑΞΗ **ΔΗΜΟΣΙΕΥΕΙ** — ΣΕ ΑΝΤΙΘΕΣΗ ΜΕ ΤΗΝ ΑΔΕΛΦΗ ΤΗΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `useListingMediaOrder` **δεν μπορεί** να βγάλει τίποτα στον κόσμο: τακτοποιεί ό,τι
 * ήδη φεύγει *(Α14.7.2)*. Αυτό εδώ **μπορεί** — και γι' αυτό η δήλωση είναι **σκέλος
 * συμμετοχής** που **προστίθεται** στους φρουρούς, ποτέ δεν τους αντικαθιστά: κάτοψη
 * χωρίς `classification: 'public'` δεν φεύγει **ούτε όταν δηλωθεί** *(Α17.7.4)*.
 *
 * 🔑 **Ο κύκλος ζωής της δήλωσης είναι ΚΟΙΝΟΣ** *(`useDeclaredFileIds`)*, γιατί το
 * **CHECK 3.28** μέτρησε ότι ήταν δίδυμο· ό,τι μένει εδώ είναι **η απόφαση**: τι σημαίνει
 * «ίδια δήλωση» *(σύνολο, όχι σειρά)*, και τι δείχνει η οθόνη σε κάθε γραμμή.
 *
 * ⚠️ **Η λίστα δείχνει ΟΛΕΣ τις κατόψεις του ακινήτου, όχι μόνο τις δημοσιεύσιμες**: ο
 * άνθρωπος πρέπει να μπορεί να **δηλώσει** μία που δεν είναι ακόμη `public` — και να δει,
 * στην ίδια γραμμή, **γιατί δεν φεύγει**. Μια λίστα που έκρυβε τις μη-δημόσιες θα ήταν
 * οθόνη που ζητά πράξη για αντικείμενα **που δεν εμφανίζει**.
 */

import { useCallback, useMemo } from 'react';

import {
  sameSet,
  useDeclaredFileIds,
  type DeclaredFileIdsState,
} from '@/hooks/listings/useDeclaredFileIds';
import {
  agencyMediaMaterial,
  type AgencyMediaCandidate,
} from '@/services/listings/agency-media-publication';

/** Μια κάτοψη όπως τη βλέπει η οθόνη: δηλωμένη; και **φεύγει** πράγματι; */
export interface ListingFloorplanRow<T extends AgencyMediaCandidate> {
  readonly file: T;
  /** Ο άνθρωπος την **ονόμασε** για αυτή την αγγελία. */
  readonly declared: boolean;
  /**
   * Φεύγει **πράγματι** στον κόσμο.
   *
   * 🔑 **Δεν είναι το ίδιο με το `declared`, και η διαφορά είναι όλο το νόημα**: δηλωμένη
   * κάτοψη που δεν είναι `public` *(ή δεν είναι αποκωδικοποιήσιμη εικόνα, π.χ. DXF)*
   * **δεν φεύγει**. Η οθόνη οφείλει να δείξει και τις δύο καταστάσεις, αλλιώς ο άνθρωπος
   * θα νόμιζε ότι η δήλωσή του αρκεί.
   */
  readonly published: boolean;
}

export interface ListingFloorplansState<T extends AgencyMediaCandidate>
  extends Pick<DeclaredFileIdsState, 'saving' | 'failed'> {
  readonly rows: readonly ListingFloorplanRow<T>[];
  readonly toggle: (fileId: string) => Promise<void>;
}

/**
 * **«Να φύγει ως κάτοψη αυτής της αγγελίας»** — δήλωση, όχι εξουσιοδότηση.
 *
 * ⚠️ **`sameSet` και όχι `sameSequence`**: εδώ η δήλωση είναι **σύνολο** — η σειρά των
 * κατόψεων μεταξύ τους την αποφασίζει το `publishedMediaOrder`, όχι αυτό το πεδίο. Μια
 * σύγκριση με σειρά θα κρατούσε την αισιόδοξη κατάσταση ζωντανή για πάντα την πρώτη φορά
 * που ο διακομιστής επέστρεφε τις **ίδιες** ταυτότητες με άλλη σειρά.
 *
 * ⚠️ **Ιδεμποτέντ ανά ταυτότητα**: το `toggle` προσθέτει ή αφαιρεί **μία** ταυτότητα, και
 * ένα διπλότυπο στο αποθηκευμένο έγγραφο *(γραμμένο από άλλη διαδρομή)* **εξαφανίζεται**
 * στην πρώτη γραφή — το `Set` δεν το ξαναγράφει.
 */
export function useListingFloorplans<T extends AgencyMediaCandidate>(
  propertyId: string,
  files: readonly T[],
  storedFloorplans: unknown,
): ListingFloorplansState<T> {
  const { declared, saving, failed, commit } = useDeclaredFileIds(
    propertyId,
    'publishedFloorplans',
    storedFloorplans,
    sameSet,
  );

  const rows = useMemo<readonly ListingFloorplanRow<T>[]>(() => {
    const selected = new Set(declared);
    return files.map((file) => ({
      file,
      declared: selected.has(file.id),
      // 🔑 **Ο ΙΔΙΟΣ κανόνας που τρέχει ο διακομιστής**, ποτέ δεύτερη διατύπωση: το
      //    `agencyMediaMaterial` απαντά *«φεύγει, και ως τι;»*. Ένα τοπικό
      //    `classification === 'public' && declared` εδώ θα ήταν **δεύτερη απάντηση**,
      //    ελεύθερη να αποκλίνει μόλις προστεθεί φρουρός.
      published: agencyMediaMaterial(file, selected) !== null,
    }));
  }, [files, declared]);

  const toggle = useCallback(
    async (fileId: string): Promise<void> => {
      const selected = new Set(declared);
      if (selected.has(fileId)) selected.delete(fileId);
      else selected.add(fileId);

      await commit([...selected]);
    },
    [declared, commit],
  );

  return { rows, saving, failed, toggle };
}

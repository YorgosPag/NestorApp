'use client';

/**
 * useSpaceFormState — η κατάσταση φόρμας της Γενικής καρτέλας ενός χώρου (θέση · αποθήκη)
 *
 * Δύο κανόνες, και οι δύο ρητοί:
 * 1. **Νέα επιλογή** (άλλο `id`) ⇒ η φόρμα ξαναγεμίζει από το αποθηκευμένο — πάντα.
 * 2. **Ίδια εγγραφή σε προβολή** ⇒ η φόρμα **ακολουθεί** τα δεδομένα του server (πρότυπο Google
 *    Docs). Σε **επεξεργασία** κρατά το πρόχειρο: ένα refetch δεν σβήνει ό,τι γράφει ο άνθρωπος.
 *
 * 🔴 Γιατί υπάρχει (ADR-777 §8.60.20, ζωντανή επαλήθευση): η φόρμα ξαναγέμιζε **μόνο** στον κανόνα 1.
 * Μετά από αποθήκευση το refetch ξαναστήνει τη λεπτομέρεια πριν φτάσουν τα φρέσκα δεδομένα, άρα η
 * οθόνη προβολής έμενε με τις τιμές **πριν** την αποθήκευση (η λειτουργική κατάσταση φαινόταν
 * «Δεν έχει δηλωθεί» ενώ η βάση έγραφε «Υπό συντήρηση») — μέχρι να επιλέξει κανείς άλλη εγγραφή.
 *
 * @module components/shared/space-info/useSpaceFormState
 */

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function useSpaceFormState<TEntity extends { readonly id: string }, TForm>(
  entity: TEntity,
  isEditing: boolean,
  build: (entity: TEntity) => TForm,
): [TForm, Dispatch<SetStateAction<TForm>>] {
  const [form, setForm] = useState<TForm>(() => build(entity));

  // Κανόνας 1 — νέα επιλογή (και σε επεξεργασία).
  useEffect(() => {
    setForm(build(entity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id]);

  // Κανόνας 2 — ίδια εγγραφή, προβολή: η οθόνη δείχνει ό,τι έχει ο server.
  useEffect(() => {
    if (!isEditing) setForm(build(entity));
  }, [entity, isEditing, build]);

  return [form, setForm];
}

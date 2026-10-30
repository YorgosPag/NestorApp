'use client';

/**
 * Οι λέξεις των λεξιλογίων διεύθυνσης έργου/κτιρίου — ΕΝΑ σημείο απόδοσης (ADR-195 (ζ) 🏷️′).
 *
 * Τιμή στη βάση = γλωσσικά ουδέτερο slug (`site`, `north`…)· η λέξη λύνεται εδώ, στην προβολή,
 * από το `addresses:types|blockSides`. Πριν ζούσαν σε τέσσερα σημεία (δύο αντίγραφα locale +
 * ελληνικοί πίνακες στο `address-helpers.ts`), και το ένα αντίγραφο δεν ήξερε το `frontage`.
 *
 * Άγκυρα: `src/types/project/__tests__/address-vocabulary-words.test.ts`.
 */

import { useMemo } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BlockSideDirection, ProjectAddressType } from '@/types/project/addresses';

export interface AddressVocabularyWords {
  addressType: (type: ProjectAddressType) => string;
  blockSide: (side: BlockSideDirection) => string;
}

export function useAddressVocabularyWords(): AddressVocabularyWords {
  const { t } = useTranslation('addresses');
  return useMemo(() => ({
    addressType: (type) => t(`types.${type}`),
    blockSide: (side) => t(`blockSides.${side}`),
  }), [t]);
}

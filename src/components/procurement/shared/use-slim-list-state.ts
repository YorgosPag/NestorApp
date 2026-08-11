'use client';

/**
 * =============================================================================
 * PROCUREMENT — Η κατάσταση μιας λεπτής λίστας, **μία φορά** (ADR-784 §10.4 · CHECK 3.28)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ:** και οι **τέσσερις** λίστες του τομέα (παραγγελίες · συμφωνίες · υλικά ·
 * προμηθευτές) άνοιγαν με το **ίδιο** μπλοκ έξι καταστάσεων και τον **ίδιο** φύλακα ταξινόμησης.
 * Το ονόμασε το **CHECK 3.28** (jscpd, ADR-584) όταν τα αρχεία ακουμπήθηκαν για τη μετανάστευση
 * του ADR-784 §10.
 *
 * ⚠️ **Ο φύλακας ταξινόμησης ΔΕΝ είναι διακοσμητικός.** Το `CompactToolbar` δίνει `string` στο
 * `onSortChange` — το `useSortState` θέλει το **κλειστό** λεξιλόγιο της λίστας. Κάθε λίστα το
 * έγραφε ως χειρόγραφη αλυσίδα `||`, δηλαδή **δεύτερη δήλωση** του ίδιου λεξιλογίου που μπορούσε
 * να αποκλίνει από τον τύπο (το σχήμα των δύο λιστών namespace του CHECK 3.34). Πλέον το
 * λεξιλόγιο δηλώνεται **μία φορά** και ο φύλακας **παράγεται** από αυτό.
 *
 * @module components/procurement/shared/use-slim-list-state
 */

import { useState } from 'react';

import { useSortState } from '@/hooks/useSortState';

export interface SlimListState<TSortKey extends string> {
  sortBy: TSortKey;
  sortOrder: 'asc' | 'desc';
  /** Φυλαγμένο: δέχεται το `string` του `CompactToolbar` και αγνοεί ό,τι δεν είναι στο λεξιλόγιο. */
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void;

  selectedItems: string[];
  setSelectedItems: (items: string[]) => void;

  searchTerm: string;
  setSearchTerm: (term: string) => void;

  activeFilters: string[];
  setActiveFilters: (filters: string[]) => void;

  showToolbar: boolean;
  setShowToolbar: (show: boolean) => void;

  /** Τα τσιπάκια γρήγορου φίλτρου — μονής επιλογής, ως πίνακας γιατί έτσι τα θέλει το κοινό component. */
  selectedFilter: string[];
  setSelectedFilter: (filter: string[]) => void;
}

/**
 * @param sortKeys — το **κλειστό λεξιλόγιο** ταξινόμησης αυτής της λίστας· είναι **και** ο φύλακας.
 * @param defaultSortKey — το αρχικό πεδίο ταξινόμησης.
 * @param defaultSortOrder — η αρχική φορά (προεπιλογή `asc`, όπως το `useSortState`).
 */
export function useSlimListState<TSortKey extends string>(
  sortKeys: readonly TSortKey[],
  defaultSortKey: TSortKey,
  defaultSortOrder: 'asc' | 'desc' = 'asc',
): SlimListState<TSortKey> {
  const { sortBy, sortOrder, onSortChange } = useSortState<TSortKey>(defaultSortKey, defaultSortOrder);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);

  const onGuardedSortChange = (nextSortBy: string, nextSortOrder: 'asc' | 'desc') => {
    const known = sortKeys.find((key) => key === nextSortBy);
    if (known !== undefined) onSortChange(known, nextSortOrder);
  };

  return {
    sortBy,
    sortOrder,
    onSortChange: onGuardedSortChange,
    selectedItems,
    setSelectedItems,
    searchTerm,
    setSearchTerm,
    activeFilters,
    setActiveFilters,
    showToolbar,
    setShowToolbar,
    selectedFilter,
    setSelectedFilter,
  };
}

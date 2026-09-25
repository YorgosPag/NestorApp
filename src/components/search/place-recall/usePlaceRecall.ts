'use client';

/**
 * **Η κατάσταση της λίστας ανάκλησης τόπου** — άνοιγμα, δείκτης, πληκτρολόγιο (ADR-882).
 *
 * Μοτίβο W3C ARIA APG *Combobox — list autocomplete*: η εστίαση DOM **δεν φεύγει ποτέ** από
 * το `<input>`· ο δείκτης ανακοινώνεται με `aria-activedescendant` (ίδια σύμβαση και ίδια
 * SSoT με το `searchable-combobox`: `optionDomId` · `applyRovingArrowKey`).
 *
 * | Πλήκτρο | Πράξη |
 * |---|---|
 * | ↓ / ↑ | ανοίγει · μετακινεί (κυκλικά) |
 * | Enter | επιλέγει την επισημασμένη — **χωρίς** επισήμανση υποβάλλει τη φόρμα κανονικά |
 * | Esc | κλείνει (το δεύτερο Esc αφήνεται στο `type="search"` να σβήσει το κείμενο) |
 * | Shift+Delete | αφαιρεί την επισημασμένη αναζήτηση από το ιστορικό (Chrome omnibox, Google) |
 *
 * ⚠️ **Η άδεια τοποθεσίας ΡΩΤΙΕΤΑΙ, δεν ΖΗΤΙΕΤΑΙ, στο άνοιγμα** — `permissions.query` δεν
 * εμφανίζει ποτέ παράθυρο. Το αίτημα γίνεται **μόνο** όταν επιλεγεί η «Τρέχουσα τοποθεσία».
 */

import { useCallback, useMemo, useState, type KeyboardEvent } from 'react';
import { applyRovingArrowKey } from '@/lib/a11y/roving-highlight';
import { optionDomId } from '@/components/ui/searchable-combobox-listbox';
import { useRecentPlaceSearches } from '@/hooks/geo/useRecentPlaceSearches';
import { useAdminAreaIndex } from '@/hooks/geo/useAdminAreaIndex';
import type { AdminArea } from '@/lib/geo/admin-area-index-file';
import {
  clearPlaceSearches,
  forgetPlaceSearch,
  type RecentPlaceSearch,
} from '@/lib/geo/recent-place-searches';
import {
  queryGeolocationPermission,
  type GeolocationPermission,
} from '@/lib/geo/current-position';
import { buildPlaceRecallOptions, type PlaceRecallOption } from './place-recall-options';

interface UsePlaceRecallArgs {
  readonly listboxId: string;
  readonly query: string;
  readonly disabled: boolean;
  readonly onPickLocation: () => void;
  readonly onPickRecent: (place: RecentPlaceSearch) => void;
  /** ADR-883 — επιλέχθηκε διοικητική περιοχή: η αναζήτηση γίνεται με το **όριό** της. */
  readonly onPickArea: (area: AdminArea) => void;
}

/** Άνοιγμα + δείκτης + άδεια — η ΜΟΝΗ κατάσταση της λίστας. */
function useRecallOpenState() {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [permission, setPermission] = useState<GeolocationPermission>('unknown');

  const show = useCallback(() => {
    setOpen(true);
    setHighlighted(-1);
    void queryGeolocationPermission().then(setPermission);
  }, []);

  // Ο άνθρωπος γράφει ⇒ η λίστα ξαναφιλτράρεται και ο δείκτης μηδενίζεται. Χωρίς νέο
  // ερώτημα άδειας: αυτό αλλάζει μόνο στις ρυθμίσεις του browser, όχι ανά πλήκτρο.
  const onQueryChange = useCallback(() => {
    setOpen(true);
    setHighlighted(-1);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setHighlighted(-1);
  }, []);

  return { open, setOpen, highlighted, setHighlighted, permission, show, onQueryChange, close };
}

export function usePlaceRecall(args: UsePlaceRecallArgs) {
  const { listboxId, query, disabled, onPickLocation, onPickRecent, onPickArea } = args;
  const history = useRecentPlaceSearches();
  const state = useRecallOpenState();
  // 🔑 Το ευρετήριο περιοχών (~100 KB) κατεβαίνει μόλις ο άνθρωπος **ανοίξει** το πεδίο ή
  //    γράψει — όχι στο φόρτωμα της αρχικής σελίδας, όπου κανείς δεν το ζήτησε ακόμη.
  const areas = useAdminAreaIndex(state.open || query.trim() !== '');
  const options = useMemo(() => buildPlaceRecallOptions(query, history, areas), [query, history, areas]);
  // Οι setters του React είναι σταθεροί — γι' αυτό μπαίνουν στις εξαρτήσεις αντί για το `state`.
  const { open, highlighted, close, setOpen, setHighlighted } = state;

  const expanded = open && !disabled && options.length > 0;
  // Η λίστα μπορεί να μικρύνει κάτω από τον δείκτη (φίλτρο, διαγραφή, άλλη καρτέλα).
  const highlightedIndex = expanded && highlighted < options.length ? highlighted : -1;

  const pick = useCallback(
    (option: PlaceRecallOption) => {
      if (option.kind === 'clear-history') {
        clearPlaceSearches();
        setHighlighted(-1);
        return;
      }
      close();
      if (option.kind === 'current-location') onPickLocation();
      else if (option.kind === 'area') onPickArea(option.area);
      else onPickRecent(option.place);
    },
    [close, setHighlighted, onPickLocation, onPickRecent, onPickArea],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (!expanded) {
        openWithArrow(event, options.length, { setOpen, setHighlighted });
        return;
      }
      if (applyRovingArrowKey(event, options.length, setHighlighted)) return;
      handleListKey(event, options[highlightedIndex], { close, pick });
    },
    [disabled, expanded, options, highlightedIndex, close, pick, setOpen, setHighlighted],
  );

  return {
    expanded,
    options,
    highlightedIndex,
    permission: state.permission,
    inputProps: {
      ...comboboxAria(listboxId, expanded, highlightedIndex),
      onKeyDown,
      onFocus: state.show,
      onClick: state.show,
      onBlur: close,
    },
    pick,
    remove: forgetPlaceSearch,
    setHighlighted,
    onQueryChange: state.onQueryChange,
    /** ADR-883 §5.8 — ανοίγει τη λίστα χωρίς επισήμανση: ο άνθρωπος διαλέγει ανάμεσα σε ομώνυμες περιοχές. */
    reveal: state.onQueryChange,
    close,
  };
}

/** Τα γνωρίσματα APG του πεδίου — ίδια σύμβαση με το `searchable-combobox`. */
function comboboxAria(listboxId: string, expanded: boolean, highlightedIndex: number) {
  return {
    role: 'combobox' as const,
    'aria-expanded': expanded,
    'aria-haspopup': 'listbox' as const,
    'aria-autocomplete': 'list' as const,
    'aria-controls': expanded ? listboxId : undefined,
    'aria-activedescendant':
      highlightedIndex >= 0 ? optionDomId(listboxId, highlightedIndex) : undefined,
    // Κλείνει το ΔΙΚΟ του ιστορικό του browser — δύο λίστες η μία πάνω στην άλλη.
    autoComplete: 'off',
  };
}

function openWithArrow(
  event: KeyboardEvent<HTMLInputElement>,
  total: number,
  state: { setOpen: (open: boolean) => void; setHighlighted: (index: number) => void },
): void {
  if (event.key !== 'ArrowDown' || total === 0) return;
  event.preventDefault();
  state.setOpen(true);
  state.setHighlighted(0);
}

function handleListKey(
  event: KeyboardEvent<HTMLInputElement>,
  active: PlaceRecallOption | undefined,
  actions: { close: () => void; pick: (option: PlaceRecallOption) => void },
): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    actions.close();
    return;
  }
  if (active === undefined) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    actions.pick(active);
    return;
  }
  if (event.key === 'Delete' && event.shiftKey && active.kind === 'recent') {
    event.preventDefault();
    forgetPlaceSearch(active.place.label);
  }
}

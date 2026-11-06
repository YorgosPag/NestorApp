/**
 * Η φόρμα κοινόχρηστου χώρου ως ΚΑΘΑΡΗ κατάσταση (ADR-931): χώρος → πρόχειρο → payload.
 *
 * Η επικύρωση εδώ είναι **ευγένεια** προς τον άνθρωπο (άμεσο μήνυμα)· ο κριτής είναι ο server
 * (`CreateCommonSpaceSchema` + `resolveLegalNature` + έλεγχος ιδιοκτησιών στο ίδιο κτίριο).
 */

import {
  DEFAULT_COMMON_SPACE_LEGAL_NATURE,
  type CommonSpaceCategory,
  type CommonSpaceLegalNature,
} from '@/constants/common-space-categories';
import { normalizeDecimalString } from '@/lib/number/locale-number';
import { formatForEditing } from '@/components/ui/numeric-field';
import type { CommonSpace } from '@/types/common-space';
import type { CommonSpaceDraftPayload } from '@/services/common-space-mutation-gateway';

export interface CommonSpaceDraft {
  readonly name: string;
  readonly category: CommonSpaceCategory;
  readonly legalNature: CommonSpaceLegalNature;
  readonly exclusiveUsePropertyIds: readonly string[];
  /** `''` = εκτείνεται σε όλο το κτίριο. */
  readonly floorId: string;
  /** Κείμενο όπως το πληκτρολογεί ο άνθρωπος· γίνεται αριθμός στο `toPayload`. */
  readonly area: string;
  readonly code: string;
  readonly notes: string;
}

export type CommonSpaceDraftError = 'nameRequired' | 'exclusiveRequired' | 'areaInvalid';

export const EMPTY_COMMON_SPACE_DRAFT: CommonSpaceDraft = {
  name: '',
  category: 'stairwell',
  legalNature: DEFAULT_COMMON_SPACE_LEGAL_NATURE,
  exclusiveUsePropertyIds: [],
  floorId: '',
  area: '',
  code: '',
  notes: '',
};

/**
 * Χώρος → πρόχειρο. Το εμβαδόν γράφεται με το δεκαδικό της γλώσσας (`12,5` στα ελληνικά) μέσω του SSoT
 * `formatForEditing` (ADR-706/576: χωρίς ομαδοποίηση χιλιάδων ⇒ ό,τι διαχωριστικό πληκτρολογηθεί είναι το δεκαδικό).
 * Το διαχωριστικό είναι **παράμετρος** ώστε η συνάρτηση να μένει καθαρή· ο καλών το λύνει από την τρέχουσα γλώσσα.
 */
export function draftFromCommonSpace(space: CommonSpace, decimalSeparator: string): CommonSpaceDraft {
  return {
    name: space.name,
    category: space.category,
    legalNature: space.legalNature,
    exclusiveUsePropertyIds: space.exclusiveUsePropertyIds ?? [],
    floorId: space.floorId ?? '',
    area: space.area !== undefined ? formatForEditing(space.area, decimalSeparator) : '',
    code: space.code ?? '',
    notes: space.notes ?? '',
  };
}

/** Κενό ⇒ `null` («δεν δηλώνεται»)· αλλιώς θετικός αριθμός ή `undefined` (άκυρο). Δέχεται `,` ως δεκαδικό. */
function parseArea(raw: string): number | null | undefined {
  const text = normalizeDecimalString(raw);
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function validateCommonSpaceDraft(draft: CommonSpaceDraft): CommonSpaceDraftError | null {
  if (draft.name.trim() === '') return 'nameRequired';
  if (parseArea(draft.area) === undefined) return 'areaInvalid';
  if (draft.legalNature === 'exclusive_use' && draft.exclusiveUsePropertyIds.length === 0) return 'exclusiveRequired';
  return null;
}

/** Πρόχειρο → payload. Καλείται **μόνο** όταν το `validateCommonSpaceDraft` επέστρεψε `null`. */
export function toCommonSpacePayload(draft: CommonSpaceDraft): CommonSpaceDraftPayload {
  const text = (value: string) => value.trim() || null;
  return {
    name: draft.name.trim(),
    category: draft.category,
    legalNature: draft.legalNature,
    exclusiveUsePropertyIds: draft.legalNature === 'exclusive_use' ? draft.exclusiveUsePropertyIds : [],
    floorId: draft.floorId || null,
    area: parseArea(draft.area) ?? null,
    code: text(draft.code),
    notes: text(draft.notes),
  };
}

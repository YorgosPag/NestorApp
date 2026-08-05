/**
 * @related ADR-759 §2β.2/§4.2 — THE ORDER OF THE CARD, and nothing else
 *
 * 🔴 ORDER IS THE CONTRACT. The engineer reads this card while looking at the
 * drawing, so the card must print the sections in the same sequence as the form
 * «ΣΤΟΙΧΕΙΑ ΕΡΕΥΝΑΣ ΙΔΙΩΤΗ ΜΗΧΑΝΙΚΟΥ» (ADR-759 §2β.2). That sequence **interleaves**:
 *
 *   Α  ΟΡΟΙ ΔΟΜΗΣΗΣ            (scalar)
 *   Α′ ΘΕΣΜΙΚΕΣ ΠΡΑΞΕΙΣ        (three lists)   ← between Α and Β, not appended
 *   Β  ΠΡΑΞΕΙΣ ΤΑΚΤΟΠΟΙΗΣΗΣ    (scalar)
 *   Γ  ΑΡΤΙΟ & ΟΙΚΟΔΟΜΗΣΙΜΟ    (scalar)
 *   Δ  ΚΑΘΟΡΙΣΜΟΣ ΡΥΜΟΤΟΜΙΑΣ   (scalar)
 *   Ε  ΕΚΤΟΣ ΑΝΑΣΤΟΛΗΣ         (scalar)
 *   ΣΤ ΕΜΒΑΔΟΝ ΟΙΚΟΠΕΔΟΥ       (scalar)
 *   Ζ  ΑΦΕΤΗΡΙΑ ΥΨΟΥΣ          (scalar)
 *   Η  ΠΑΡΑΤΗΡΗΣΕΙΣ            (list)
 *   Θ  ΕΓΚΡΙΣΕΙΣ               (list)
 *   Ι  ΤΙΤΛΟΙ ΙΔΙΟΚΤΗΣΙΑΣ      (list)
 *
 * 🔑 WHY THIS FILE EXISTS AT ALL. The obvious alternative is to write the sequence
 * as JSX in the tab. Then half the contract lives in a config array with a test on
 * it, and half lives in markup with nothing watching — and the existing order test
 * would keep passing while the visible order drifted. This project has paid for that
 * shape more than once (CHECK 3.34: two hand-kept namespace lists that diverged by 63
 * with no gate comparing them; ADR-587 §6.1: *an anchor without a gate is a comment*).
 * So the order is data, in one place, with one test over the whole eleven.
 *
 * Kept separate from both config files to avoid an import cycle: this one composes
 * them, neither of them knows about it.
 */
import {
  SURVEY_CARD_SECTIONS,
  SURVEY_SECTION_A,
  SURVEY_SECTION_B,
  SURVEY_SECTION_C,
  SURVEY_SECTION_D,
  SURVEY_SECTION_E,
  SURVEY_SECTION_ST,
  SURVEY_SECTION_Z,
  type SurveyCardSection,
} from '@/config/survey-card-config';
import {
  SURVEY_ACT_SECTIONS,
  SURVEY_APPROVALS_SECTION,
  SURVEY_LIST_SECTIONS,
  SURVEY_REMARKS_SECTION,
  SURVEY_TITLE_DEEDS_SECTION,
  type SurveyListSection,
} from '@/config/survey-list-config';

/**
 * One thing the card prints, in order.
 *
 * `listGroup` binds a heading to the lists under it — section Α′ is one heading over
 * three named groups. Modelling it as a heading entry *plus* three list entries
 * would let the heading drift away from what it titles; this cannot.
 */
export type SurveyCardEntry =
  | { readonly kind: 'scalar'; readonly section: SurveyCardSection }
  | { readonly kind: 'list'; readonly section: SurveyListSection }
  | {
      readonly kind: 'listGroup';
      /** i18n key for the heading over the group. */
      readonly titleKey: string;
      readonly sections: readonly SurveyListSection[];
    };

/** The card, in the order of the printed form. The single source of that order. */
export const SURVEY_CARD_ORDER: readonly SurveyCardEntry[] = [
  { kind: 'scalar', section: SURVEY_SECTION_A },
  { kind: 'listGroup', titleKey: 'sections.aActs', sections: SURVEY_ACT_SECTIONS },
  { kind: 'scalar', section: SURVEY_SECTION_B },
  { kind: 'scalar', section: SURVEY_SECTION_C },
  { kind: 'scalar', section: SURVEY_SECTION_D },
  { kind: 'scalar', section: SURVEY_SECTION_E },
  { kind: 'scalar', section: SURVEY_SECTION_ST },
  { kind: 'scalar', section: SURVEY_SECTION_Z },
  { kind: 'list', section: SURVEY_REMARKS_SECTION },
  { kind: 'list', section: SURVEY_APPROVALS_SECTION },
  { kind: 'list', section: SURVEY_TITLE_DEEDS_SECTION },
];

/**
 * Every scalar section the order renders. Derived, so the completeness test can ask
 * "is anything defined but not rendered?" without restating the list.
 */
export function orderedScalarSections(): readonly SurveyCardSection[] {
  return SURVEY_CARD_ORDER.flatMap((entry) =>
    entry.kind === 'scalar' ? [entry.section] : []
  );
}

/** Every repeating section the order renders, flattened out of the groups. */
export function orderedListSections(): readonly SurveyListSection[] {
  return SURVEY_CARD_ORDER.flatMap((entry) => {
    switch (entry.kind) {
      case 'scalar':
        return [];
      case 'list':
        return [entry.section];
      case 'listGroup':
        return entry.sections;
      default: {
        // Adding an entry kind without teaching this function about it must not
        // silently drop sections from the completeness check.
        const never: never = entry;
        throw new Error(`orderedListSections: unhandled entry ${String(never)}`);
      }
    }
  });
}

/** Everything defined anywhere, for the completeness anchor. */
export const ALL_DEFINED_SECTIONS = {
  scalar: SURVEY_CARD_SECTIONS,
  list: SURVEY_LIST_SECTIONS,
} as const;

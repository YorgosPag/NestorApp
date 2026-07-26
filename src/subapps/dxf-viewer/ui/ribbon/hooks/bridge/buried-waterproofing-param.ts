/**
 * ADR-715 — Στεγάνωση θαμμένης ζώνης («Κοντόστυλο») ως Properties-panel bridge SSoT.
 *
 * Mirror του `finish-param.ts` (σοβάς): combobox options + generic read/apply helpers πάνω στον
 * pure core (`bim/finishes/buried-waterproofing`). Entity-agnostic — δουλεύει σε οτιδήποτε έχει
 * `buriedWaterproofing?`, ώστε όταν αποκτήσουν θαμμένη ζώνη και άλλα στοιχεία (ADR-713 §6) να
 * μην ξαναγραφεί τίποτα εδώ.
 *
 * ### Τα options ΠΑΡΑΓΟΝΤΑΙ από τον κατάλογο — δεν γράφονται με το χέρι
 * Το `finish-param` απαριθμεί δύο υλικά σοβά ρητά. Εδώ είναι **οκτώ** και θα γίνουν περισσότερα,
 * οπότε μια χειρόγραφη λίστα θα ήταν δεύτερη πηγή αλήθειας που ξεχνιέται: το ADR-713 ακριβώς
 * αυτό έπαθε — πρόσθεσε τρία υλικά και **ξέχασε τις ετικέτες** σε κάθε locale (§5.2). Εδώ η λίστα
 * είναι `map` πάνω στο `BURIED_WATERPROOFING_CATALOG`, άρα ένα νέο υλικό εμφανίζεται στο UI
 * **αυτόματα**, στη σωστή ομάδα, με το κλειδί ετικέτας που ήδη επιβάλλει το
 * `buried-waterproofing-catalog.test.ts`.
 *
 * ### Η ομαδοποίηση είναι τεχνική απόφαση, όχι διακόσμηση
 * Ο μηχανικός δεν διαλέγει από 8 ισότιμα ονόματα: πρώτα αποφασίζει «επάλειψη ή μεμβράνη;»
 * (διαφορετική εργασία, διαφορετικό συνεργείο, διαφορετική τιμή) και μετά υλικό. Γι' αυτό τα
 * options φέρουν `groupLabelKey` και το Radix Select τα αποδίδει σε `SelectGroup`.
 *
 * @see ../../../../bim/finishes/buried-waterproofing.ts — ο κατάλογος + τα defaults (pure SSoT)
 * @see ./finish-param.ts — ο αδελφός μηχανισμός (σοβάς, εκτεθειμένη ζώνη)
 * @see docs/centralized-systems/reference/adrs/ADR-715-buried-part-independent-selection-and-waterproofing-catalog.md
 */

import {
  BURIED_WATERPROOFING_CATALOG,
  DEFAULT_BURIED_WATERPROOFING_MATERIAL,
  resolveBuriedWaterproofing,
  type BuriedWaterproofingSpec,
} from '../../../../bim/finishes/buried-waterproofing';
// Η ετικέτα βγαίνει από το ΙΔΙΟ helper που χρησιμοποιεί η βιβλιοθήκη υλικών και τα schedules
// (namespace `dxf-viewer-shell` — ακριβώς αυτό που φορτώνει ο `BimPropertyRow`).
import { constructionMaterialLabelKey } from '../../../../bim/materials/construction-materials';
import type { BimPropertyOption } from '../../../bim-properties/bim-property-types';

/** Τα πεδία του spec που εκθέτει το panel. */
export type BuriedWaterproofingField = 'enabled' | 'materialId';

/** Master διακόπτης στεγάνωσης ανά στοιχείο (Ναι/Όχι). Reuse των ετικετών του σοβά (ίδιο ερώτημα). */
export const BURIED_WATERPROOFING_ENABLED_OPTIONS: readonly BimPropertyOption[] = [
  { value: 'on', labelKey: 'ribbon.commands.finishEditor.enabled.on', isLiteralLabel: false },
  { value: 'off', labelKey: 'ribbon.commands.finishEditor.enabled.off', isLiteralLabel: false },
];

/**
 * Τα 8 υλικά στεγάνωσης, **παράγωγα** του καταλόγου, ομαδοποιημένα σε «Επαλειφόμενα» /
 * «Μεμβράνες». Η σειρά είναι η σειρά του καταλόγου (συχνότερο πρώτα) — και επειδή ο κατάλογος
 * είναι ήδη ταξινομημένος coating-πρώτα, οι ομάδες βγαίνουν συνεχόμενες χωρίς ξεχωριστό sort.
 */
export const BURIED_WATERPROOFING_MATERIAL_OPTIONS: readonly BimPropertyOption[] =
  BURIED_WATERPROOFING_CATALOG.map((option) => ({
    value: option.id,
    labelKey: constructionMaterialLabelKey(option.id),
    isLiteralLabel: false,
    groupLabelKey:
      option.kind === 'coating'
        ? 'columnAdvancedPanel.sections.buriedWaterproofing.kindCoating'
        : 'columnAdvancedPanel.sections.buriedWaterproofing.kindMembrane',
  }));

/**
 * Η τιμή combobox ενός πεδίου, **πάντα resolved** μέσω `resolveBuriedWaterproofing` — άρα ένα
 * έργο χωρίς το πεδίο δείχνει «Ναι / Ασφαλτική επάλειψη» (το πραγματικό default, ADR-713 §2.3)
 * και **όχι** κενό. Κενό control εδώ θα διάβαζε ως «καμία στεγάνωση», που είναι ψέμα: η
 * στεγάνωση εφαρμόζεται ήδη — απλώς δεν είχε ρητή δήλωση.
 */
export function readBuriedWaterproofingValue(
  spec: BuriedWaterproofingSpec | undefined,
  field: BuriedWaterproofingField,
): string {
  const resolved = resolveBuriedWaterproofing(spec);
  return field === 'enabled' ? (resolved.enabled ? 'on' : 'off') : resolved.materialId;
}

/**
 * Το επόμενο spec μετά από αλλαγή combobox, ή `null` όταν η τιμή είναι άκυρη (no-op).
 *
 * Merge (όχι replace): αλλαγή υλικού δεν αγγίζει τον διακόπτη και αντίστροφα. Η επιλογή υλικού
 * **ενεργοποιεί** ρητά τη στεγάνωση: διαλέγοντας μεμβράνη σε κλειστή στεγάνωση, η πρόθεση είναι
 * προφανώς «στεγάνωσε με μεμβράνη» — αλλιώς ο χρήστης θα διάλεγε υλικό που δεν εφαρμόζεται
 * πουθενά και θα το ανακάλυπτε μόνο από την απούσα γραμμή επιμέτρησης.
 */
export function applyBuriedWaterproofingParam(
  spec: BuriedWaterproofingSpec | undefined,
  field: BuriedWaterproofingField,
  value: string,
): BuriedWaterproofingSpec | null {
  if (field === 'enabled') {
    if (value !== 'on' && value !== 'off') return null;
    return { ...spec, enabled: value === 'on' };
  }
  const known = BURIED_WATERPROOFING_CATALOG.some((option) => option.id === value);
  if (!known) return null;
  return { ...spec, enabled: true, materialId: value };
}

/** Το default υλικό, re-exported ώστε το panel να μη μαντεύει (και να μην το γράψει δεύτερος). */
export { DEFAULT_BURIED_WATERPROOFING_MATERIAL };

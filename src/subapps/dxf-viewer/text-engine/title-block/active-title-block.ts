/**
 * ADR-651 Φάσεις Β+Γ — η πινακίδα «του ΤΩΡΑ»: ποιο πρότυπο, ποιο φύλλο, ποια δεδομένα,
 * ποια κλίμακα.
 *
 * Event-time σύνθεση (ADR-040: getters, όχι snapshots) — τρέχει στο κλικ **και** στο ghost:
 *  - **πρότυπο**: το preset του ribbon (`title-block-options-store`) στη γλώσσα του χρήστη —
 *    βιβλιοθήκη «Τυπική / Άδεια δόμησης / Απλή / Λεπτομέρεια» (Απόφαση #3, EL+EN Απόφαση #8).
 *  - **φύλλο**: μέγεθος + προσανατολισμός + κορνίζα από το ίδιο store (Φάση Γ· ISO 5457
 *    reflow A4↔A0 — καμία σταθερή διάσταση πουθενά).
 *  - **δεδομένα**: Firestore-derived scope από το cache (`placeholder-scope-client`) + τα
 *    facts που ΑΝΗΚΟΥΝ στο σχέδιο (ενεργή κλίμακα) — ο διαχωρισμός που ήδη δηλώνει ο
 *    `scope-builder` (Firestore vs caller-supplied).
 *  - **μέγεθος**: annotative — paper-mm × ενεργός συντελεστής κλίμακας (1:50 ⇒ ×50), ώστε
 *    η πινακίδα να έχει σωστό ΤΥΠΩΜΕΝΟ μέγεθος πάνω σε σχέδιο κτιρίου (AutoCAD behaviour).
 *
 * Zero-config auto-fill (Απόφαση #4): ο χρήστης δεν πληκτρολογεί τίποτα — αν λείπει scope
 * (π.χ. χωρίς ενεργό έργο), τα πεδία μένουν κενά και η πινακίδα μπαίνει ούτως ή άλλως.
 */

import { getActiveScaleFactor, getActiveScaleName } from '../../systems/viewport/ViewportStore';
import type { InSessionBlockDef } from '../../bim/block-library/block-library-types';
import {
  getActiveTitleBlockPaper,
  useTitleBlockOptionsStore,
} from '../../state/title-block-options-store';
import {
  getPlaceholderScopeSources,
  loadPlaceholderScope,
} from '../templates/resolver/placeholder-scope-client';
import type { PlaceholderScope, PlaceholderScopeRevision } from '../templates/resolver/scope.types';
import { getActiveRevisionFacts, loadProjectRevisions } from './revisions/revision-client';
import type { TextTemplate } from '../templates/template.types';
import type { TitleBlockSheetOptions } from './print-sheet';
import { getStampImage, loadStampImage } from './stamp-image-client';
import { validateTitleBlock, type TitleBlockIssue } from './title-block-compliance';
import { buildTitleBlockDef } from './title-block-def';
import type { TitleBlockLayoutOptions, TitleBlockStampImage } from './title-block-layout';
import { titleBlockPreset, type TitleBlockLocale } from './title-block-presets';

/**
 * Το ενεργό πρότυπο στη ζητούμενη γλώσσα. Η **AI πινακίδα** (Φάση Δ) υπερισχύει του preset
 * (φέρει ήδη μία γλώσσα)· αλλιώς το επιλεγμένο preset (Απόφαση #8: ελληνικά default, κουμπί → EN).
 */
export function titleBlockTemplateForLocale(locale: TitleBlockLocale): TextTemplate {
  const { presetId, aiOverride } = useTitleBlockOptionsStore.getState();
  if (aiOverride) return aiOverride.template;
  return titleBlockPreset(presetId).templates[locale];
}

/** Το κελί σφραγίδας του ενεργού (AI override ή preset) — SSoT για layout ΚΑΙ έλεγχο πληρότητας. */
function activeStampMeta(locale: TitleBlockLocale): { withStampBox: boolean; stampLabel: string } {
  const { presetId, aiOverride } = useTitleBlockOptionsStore.getState();
  if (aiOverride) return { withStampBox: aiOverride.withStampBox, stampLabel: aiOverride.stampLabel };
  const preset = titleBlockPreset(presetId);
  return { withStampBox: preset.withStampBox, stampLabel: preset.stampLabel[locale] };
}

/** Ό,τι δεν προκύπτει από το ενεργό σχέδιο και το ξέρει καλύτερα ο καλών. */
export interface TitleBlockScopeOverrides {
  /**
   * Η κλίμακα που γράφεται στην πινακίδα. Στην **εκτύπωση** (Φάση ΣΤ) είναι η κλίμακα που
   * ΤΥΠΩΝΕΤΑΙ (1:N του διαλόγου), όχι η κλίμακα της οθόνης — αλλιώς το τυπωμένο σχέδιο θα
   * δήλωνε κλίμακα που δεν έχει.
   */
  readonly scaleName?: string;
  /**
   * ADR-651 Φάση Ζ — ο τίτλος του φύλλου (όνομα ορόφου) όταν τυπώνεται **σετ φύλλων**: κάθε
   * φύλλο του σετ έχει διαφορετικό `{{drawing.title}}`, ίδια κατά τα άλλα πινακίδα.
   */
  readonly title?: string;
  /**
   * ADR-651 Φάση Ζ — ο αυτόματος αριθμός φύλλου (Α-1, Α-2…) στο σετ, στο
   * `{{drawing.sheetNumber}}`. Παράγεται ντετερμινιστικά από τη θέση στο σετ
   * (`sheet-numbering.ts`) — καμία χειρόγραφη αρίθμηση.
   */
  readonly sheetNumber?: string;
  /**
   * ADR-651 Φάση Η — η αναθεώρηση που γράφεται στην πινακίδα (`{{revision.*}}`). Κανονικά
   * είναι η **τρέχουσα** του έργου (τελευταία καταχωρημένη, από το `revision-client` cache)·
   * ο καλών τη δίνει ρητά μόνο για **προεπισκόπηση** (π.χ. ο διάλογος αναθεωρήσεων δείχνει
   * πώς θα φαίνεται η υπό έγκριση αναθεώρηση **πριν** καταχωρηθεί).
   *
   * ⚠️ `revision.date` είναι `Date` — γι' αυτό τα revision facts είναι **client-owned** και
   * ΔΕΝ ταξιδεύουν στο `PlaceholderScopeSources` του route (δεν είναι JSON-safe· §5.1).
   */
  readonly revision?: PlaceholderScopeRevision;
}

/** Firestore scope (cached) + τα drawing facts που ζουν στο ενεργό σχέδιο. */
export function buildActiveTitleBlockScope(
  locale: TitleBlockLocale,
  overrides?: TitleBlockScopeOverrides,
): PlaceholderScope {
  return {
    ...getPlaceholderScopeSources(),
    drawing: {
      scale: overrides?.scaleName ?? getActiveScaleName(),
      title: overrides?.title,
      sheetNumber: overrides?.sheetNumber,
    },
    // Φάση Η — ο παραγωγός που έλειπε: τα `revision.*` placeholders υπήρχαν από το ADR-344
    // αλλά κανείς δεν τα γέμιζε. Πλέον η **τρέχουσα** αναθεώρηση του έργου φτάνει στην
    // πινακίδα ΚΑΙ στον πίνακα αναθεωρήσεων, στα 3 backends, από το ΙΔΙΟ κανάλι overrides.
    revision: overrides?.revision ?? getActiveRevisionFacts(locale),
    formatting: { locale },
  };
}

/**
 * ADR-651 Φάση Ε — σε ποια μορφή θέλει την εικόνα σφραγίδας το backend του καλούντος:
 *  - `'url'` → in-scene `ImageEntity` (το σχέδιο κρατά **αναφορά**, όχι pixels),
 *  - `'data-url'` → PDF (ο jsPDF `addImage` δεν δέχεται remote URL).
 */
export type StampImageForm = 'url' | 'data-url';

/**
 * Η **προ-φόρτωση** όλων όσων χρειάζεται η πινακίδα, σε ΕΝΑ σημείο (N.7.2 #7: ένας ιδιοκτήτης
 * του lifecycle): στοιχεία έργου/μελετητή **και** η εικόνα σφραγίδας. Καλείται όταν οπλίζεται
 * το εργαλείο και όταν ανοίγει ο διάλογος εκτύπωσης ⇒ το μονοπάτι σχεδίασης μένει **σύγχρονο**
 * (μηδέν `await` στο κλικ/ghost/PDF — ADR-040). Idempotent· αποτυχία ⇒ κενά πεδία/κενή σφραγίδα.
 */
export async function loadTitleBlockAssets(projectId?: string): Promise<void> {
  const sources = await loadPlaceholderScope(projectId);
  await Promise.all([
    loadStampImage(sources.user?.stampImageUrl),
    // Φάση Η — η τρέχουσα αναθεώρηση του έργου, στο ΙΔΙΟ σημείο προ-φόρτωσης (ένας ιδιοκτήτης
    // του lifecycle): ό,τι φορτώνει η πινακίδα, φορτώνεται εδώ και διαβάζεται σύγχρονα μετά.
    loadProjectRevisions(projectId),
  ]);
}

/** Η σφραγίδα του ενεργού μηχανικού, στη μορφή που ζητά ο καλών (event-time read). */
export function buildActiveStampImage(form: StampImageForm): TitleBlockStampImage | null {
  const image = getStampImage(getPlaceholderScopeSources().user?.stampImageUrl);
  if (!image) return null;
  return {
    src: form === 'data-url' ? image.dataUrl : image.url,
    widthPx: image.widthPx,
    heightPx: image.heightPx,
  };
}

/** Οι γεωμετρικές επιλογές του ενεργού preset **χωρίς** το χαρτί (event-time read). */
export function buildActiveTitleBlockSheetOptions(
  locale: TitleBlockLocale,
  stampForm: StampImageForm = 'url',
): TitleBlockSheetOptions {
  const { withFrame } = useTitleBlockOptionsStore.getState();
  const stamp = activeStampMeta(locale);
  return {
    withFrame,
    withStampBox: stamp.withStampBox,
    stampLabel: stamp.stampLabel,
    stampImage: buildActiveStampImage(stampForm),
  };
}

/** Το ενεργό φύλλο + οι γεωμετρικές επιλογές του preset (Φάση Γ — event-time read). */
export function buildActiveTitleBlockLayoutOptions(
  locale: TitleBlockLocale,
): TitleBlockLayoutOptions {
  return {
    ...buildActiveTitleBlockSheetOptions(locale),
    paper: getActiveTitleBlockPaper(),
  };
}

/**
 * ADR-651 Φάση Ε (Απόφαση #4) — τι λείπει από την **ενεργή** πινακίδα για να είναι
 * καταθέσιμη. Ίδιο preset, ίδιο scope, ίδια κλίμακα με αυτά που θα τυπωθούν ⇒ η
 * προειδοποίηση λέει την αλήθεια για το ΣΥΓΚΕΚΡΙΜΕΝΟ φύλλο (π.χ. «fit-to-page» ⇒ η
 * κλίμακα γράφεται `—` ⇒ **λείπει κλίμακα**, και ο μηχανικός το μαθαίνει ΠΡΙΝ καταθέσει).
 */
export function validateActiveTitleBlock(
  locale: TitleBlockLocale,
  overrides?: TitleBlockScopeOverrides,
): readonly TitleBlockIssue[] {
  return validateTitleBlock({
    template: titleBlockTemplateForLocale(locale),
    scope: buildActiveTitleBlockScope(locale, overrides),
    withStampBox: activeStampMeta(locale).withStampBox,
    stampImageUrl: getPlaceholderScopeSources().user?.stampImageUrl,
  });
}

/** Ο block-local ορισμός της πινακίδας για το τρέχον preset/φύλλο/γλώσσα/κλίμακα/έργο. */
export function buildActiveTitleBlockDef(locale: TitleBlockLocale): InSessionBlockDef {
  return buildTitleBlockDef(
    titleBlockTemplateForLocale(locale),
    buildActiveTitleBlockScope(locale),
    {
      scaleFactor: getActiveScaleFactor(),
      layout: buildActiveTitleBlockLayoutOptions(locale),
    },
  );
}

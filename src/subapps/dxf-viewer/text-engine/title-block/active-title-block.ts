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
  getActiveScopeProjectId,
  getPlaceholderScopeSources,
  loadPlaceholderScope,
} from '../templates/resolver/placeholder-scope-client';
import type { PlaceholderScope, PlaceholderScopeRevision } from '../templates/resolver/scope.types';
import {
  getActiveRevisionFacts,
  getCurrentRevision,
  loadProjectRevisions,
} from './revisions/revision-client';
import {
  buildTitleBlockFingerprint,
  buildTitleBlockQrPayload,
  resolveTitleBlockQrBaseUrl,
  type TitleBlockVersionFacts,
} from './title-block-fingerprint';
import { getTitleBlockQr, loadTitleBlockQr } from './qr-image-client';
import type { TextTemplate, TextTemplateTitleBlockMeta } from '../templates/template.types';
import type { TitleBlockSheetOptions } from './print-sheet';
import { getStampImage, loadStampImage } from './stamp-image-client';
import { findTitleBlockVariant } from './localization/title-block-variant';
import {
  getTitleBlockLibraryTemplate,
  listTitleBlockLibrary,
} from './title-block-library-store';
import { validateTitleBlock, type TitleBlockIssue } from './title-block-compliance';
import { buildTitleBlockDef } from './title-block-def';
import type { TitleBlockLayoutOptions, TitleBlockStampImage } from './title-block-layout';
import { titleBlockPreset, type TitleBlockLocale } from './title-block-presets';

/**
 * ADR-651 Φάση Θ — το ενεργό πρότυπο, **από όποια βαθμίδα κι αν προέρχεται**. Τρεις πηγές, μία
 * απάντηση (σειρά προτεραιότητας):
 *
 *  1. **AI πινακίδα** (Φάση Δ) — εφήμερη, υπερισχύει ρητά όσο είναι οπλισμένη,
 *  2. **αποθηκευμένο πρότυπο βιβλιοθήκης** (Φάση Θ) — γραφείου/έργου/μου· το `presetId` του
 *     store κρατά τότε το **enterprise id** (`tpl_text_*`). Επειδή τα φύλλα **δείχνουν** στο
 *     ίδιο έγγραφο, μια αλλαγή στο master του γραφείου φτάνει εδώ ζωντανά — αυτό είναι το
 *     «αλλάζω το master → ενημερώνονται όλα τα φύλλα» (must-have #1),
 *  3. **built-in preset** (Φάση Γ) — και ως fallback σε άγνωστο/διαγραμμένο id (ποτέ crash).
 */
export function titleBlockTemplateForLocale(locale: TitleBlockLocale): TextTemplate {
  return resolveActiveTitleBlock(locale).template;
}

/** Η ενεργή πινακίδα: το πρότυπο ΚΑΙ το κελί σφραγίδας του — πάντα από την ίδια βαθμίδα. */
interface ActiveTitleBlock {
  readonly template: TextTemplate;
  readonly withStampBox: boolean;
  readonly stampLabel: string;
}

/**
 * Η **μία** ανάγνωση της ενεργής πινακίδας (πρότυπο + σφραγίδα μαζί).
 *
 * ⚠️ Πρότυπο και κελί σφραγίδας λύνονταν χωριστά — δύο παράλληλες αναζητήσεις στις ίδιες τρεις
 * βαθμίδες. Με τη γλωσσική παραλλαγή (Φάση Κ) αυτό θα έσπαγε σιωπηλά: η πινακίδα θα τύπωνε
 * αγγλικό κείμενο με **ελληνική** σφραγίδα. Μία απάντηση, ένας ιδιοκτήτης (N.7.2 #5).
 *
 * ADR-651 Φάση Κ — για ένα **αποθηκευμένο** πρότυπο η γλώσσα δεν αλλάζει το περιεχόμενο
 * επιτόπου: ψάχνει τη γλωσσική **παραλλαγή** που έφτιαξε και ενέκρινε ο χρήστης. Δεν υπάρχει
 * παραλλαγή ⇒ μένει το πρότυπο ως έχει (**ποτέ** σιωπηλή μηχανική μετάφραση σε σχέδιο).
 */
function resolveActiveTitleBlock(locale: TitleBlockLocale): ActiveTitleBlock {
  const { presetId, aiOverride } = useTitleBlockOptionsStore.getState();
  if (aiOverride) {
    return {
      template: aiOverride.template,
      withStampBox: aiOverride.withStampBox,
      stampLabel: aiOverride.stampLabel,
    };
  }

  const saved = getTitleBlockLibraryTemplate(presetId);
  if (saved) {
    // Ένα αποθηκευμένο πρότυπο κουβαλά το δικό του `titleBlock` metadata (σφραγίστηκε τη στιγμή
    // που σώθηκε) ⇒ τυπώνεται **ακριβώς όπως το είδε** ο χρήστης. Αν λείπει (σωσμένο χωρίς
    // κελί), ισχύει «χωρίς σφραγίδα» — ποτέ σιωπηλά τα meta άλλου preset.
    const active = findTitleBlockVariant(listTitleBlockLibrary(), saved, locale) ?? saved;
    return {
      template: active,
      withStampBox: active.titleBlock?.withStampBox ?? false,
      stampLabel: active.titleBlock?.stampLabel ?? '',
    };
  }

  const preset = titleBlockPreset(presetId);
  return {
    template: preset.templates[locale],
    withStampBox: preset.withStampBox,
    stampLabel: preset.stampLabel[locale],
  };
}

/** Το κελί σφραγίδας της ενεργής πινακίδας — SSoT για layout ΚΑΙ έλεγχο πληρότητας. */
function activeStampMeta(locale: TitleBlockLocale): { withStampBox: boolean; stampLabel: string } {
  const { withStampBox, stampLabel } = resolveActiveTitleBlock(locale);
  return { withStampBox, stampLabel };
}

/**
 * ADR-651 Φάση Θ — ό,τι χρειάζεται για να **αποθηκευτεί η ενεργή πινακίδα** ως πρότυπο
 * βιβλιοθήκης: το περιεχόμενό της και το κελί σφραγίδας της, **ακριβώς όπως τα βλέπει τώρα**
 * ο χρήστης (preset, AI πινακίδα ή ήδη αποθηκευμένο πρότυπο — μία απάντηση για τα τρία).
 *
 * Εκτίθεται εδώ και όχι στο UI, ώστε ο διάλογος να μη μαντεύει ποτέ ποια είναι «η ενεργή
 * πινακίδα»: το ερώτημα έχει **έναν** ιδιοκτήτη (N.7.2 #7).
 */
export function buildActiveTitleBlockSaveContent(locale: TitleBlockLocale): {
  readonly content: TextTemplate['content'];
  readonly titleBlock: TextTemplateTitleBlockMeta;
} {
  const stamp = activeStampMeta(locale);
  return {
    content: titleBlockTemplateForLocale(locale).content,
    titleBlock: { withStampBox: stamp.withStampBox, stampLabel: stamp.stampLabel },
  };
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
  // Φάση Λ — το QR χτίζεται από projectId + τρέχουσα αναθεώρηση: γεννιέται ΜΕΤΑ το revision load,
  // εδώ (ίδιος ιδιοκτήτης lifecycle), ώστε το render path να το διαβάζει σύγχρονα (ADR-040).
  await warmActiveTitleBlockQr();
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

/**
 * ADR-651 Φάση Λ — τα **raw** facts έκδοσης του ενεργού φύλλου (event-time read). Locale-INDEPENDENT
 * (ακέραιη αναθεώρηση, όχι «3η»/«3») ⇒ ίδια έκδοση ⇒ ίδιο αποτύπωμα σε EL και EN. Ο αριθμός φύλλου
 * έρχεται από τα `overrides` (διαφέρει ανά φύλλο σε σετ)· in-scene μένει κενός.
 */
function collectTitleBlockVersionFacts(overrides?: TitleBlockScopeOverrides): TitleBlockVersionFacts {
  return {
    projectId: getActiveScopeProjectId(),
    sheetNumber: overrides?.sheetNumber,
    revisionNumber: getCurrentRevision()?.number,
  };
}

/** Το κείμενο που κωδικοποιεί το QR (σύνδεσμος έργου + αποτύπωμα έκδοσης — Δρόμος Γ). `''` ⇒ κανένα. */
function buildActiveQrPayload(overrides?: TitleBlockScopeOverrides): string {
  const facts = collectTitleBlockVersionFacts(overrides);
  return buildTitleBlockQrPayload({
    baseUrl: resolveTitleBlockQrBaseUrl(),
    projectId: facts.projectId,
    fingerprint: buildTitleBlockFingerprint(facts),
  });
}

/**
 * Το QR ως εικόνα κελιού (event-time read) — `null` όταν ο χρήστης δεν το θέλει, δεν υπάρχουν
 * facts έκδοσης, ή δεν έχει προ-φορτωθεί (ίδια χαριτωμένη υποβάθμιση με τη σφραγίδα).
 */
export function buildActiveTitleBlockQrImage(
  overrides?: TitleBlockScopeOverrides,
): TitleBlockStampImage | null {
  if (!useTitleBlockOptionsStore.getState().withQr) return null;
  const payload = buildActiveQrPayload(overrides);
  if (!payload) return null;
  const qr = getTitleBlockQr(payload);
  if (!qr) return null;
  return { src: qr.dataUrl, widthPx: qr.sizePx, heightPx: qr.sizePx };
}

/**
 * Προ-φορτώνει (γεννά+cache-άρει) το QR του τρέχοντος context — μία φορά, εκ των προτέρων, ώστε το
 * render path να μένει σύγχρονο (ADR-040). Ασυνθήκευτο (γεννιέται ακόμη κι όταν το toggle είναι off
 * ⇒ εμφανίζεται **αμέσως** μόλις ο χρήστης το ανάψει, χωρίς νέο όπλισμα). Idempotent.
 */
export async function warmActiveTitleBlockQr(overrides?: TitleBlockScopeOverrides): Promise<void> {
  const payload = buildActiveQrPayload(overrides);
  if (payload) await loadTitleBlockQr(payload);
}

/**
 * Οι γεωμετρικές επιλογές του ενεργού preset **χωρίς** το χαρτί (event-time read).
 *
 * ADR-651 Φάση Λ — τα `overrides` περνούν στο QR ώστε το αποτύπωμα να φέρει τον σωστό αριθμό
 * φύλλου σε **σετ** (κάθε φύλλο = δικό του QR)· in-scene/single δεν χρειάζονται overrides.
 */
export function buildActiveTitleBlockSheetOptions(
  locale: TitleBlockLocale,
  stampForm: StampImageForm = 'url',
  overrides?: TitleBlockScopeOverrides,
): TitleBlockSheetOptions {
  const { withFrame, withQr } = useTitleBlockOptionsStore.getState();
  const stamp = activeStampMeta(locale);
  return {
    withFrame,
    withStampBox: stamp.withStampBox,
    stampLabel: stamp.stampLabel,
    stampImage: buildActiveStampImage(stampForm),
    withQr,
    qrImage: buildActiveTitleBlockQrImage(overrides),
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

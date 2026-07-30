/**
 * ADR-736 Φ3α — **ΤΑΥΤΙΣΗ**: ποιο από τα αρχεία που έδωσε ο χρήστης είναι το υπόβαθρο που
 * ζητά κάθε αναφορά του DXF.
 *
 * 🔴 **Καθαρή συνάρτηση.** Μηδέν δίκτυο, μηδέν Firebase, μηδέν React. Η μόνη «βρώμικη» ανάγκη
 * — να μετρηθούν οι διαστάσεις ενός αρχείου — έρχεται **injected** ({@link ReferenceMatchDeps}),
 * ίδιο μοτίβο DI με το `foreign-texture-deps.ts` (ADR-691). Έτσι ολόκληρη η λογική απόφασης
 * ελέγχεται χωρίς browser.
 *
 * ## Η σκάλα, και γιατί έχει αυτή τη σειρά
 *
 * | # | Πέρασμα | Απαντά |
 * |---|---------|--------|
 * | 1 | **ακριβές όνομα** | ο χρήστης έδωσε ακριβώς αυτό που λέει το σχέδιο |
 * | 2 | **όνομα χωρίς πεζά/κεφαλαία** | Windows: `dianomi_1.JPG` δηλωμένο, `dianomi_1.jpg` δοσμένο |
 * | 3 | **όνομα χωρίς κατάληξη** | ξανα-εξαγωγή σε άλλη μορφή (`1.tif` → `1.jpg`) |
 * | 4 | **διαστάσεις σε pixels** | το αρχείο **μετονομάστηκε** — το μόνο που έμεινε κοινό |
 *
 * Το 4 δεν είναι «έσχατη λύση για την περίπτωση» — είναι το πέρασμα που **λύνει το πραγματικό
 * δείγμα**: 9 από τα 10 υπόβαθρα υπάρχουν δίπλα στο `.dxf` με **άλλα ονόματα**. Χωρίς αυτό, η
 * αυτόματη επίλυση θα εύρισκε μηδέν.
 *
 * ## Δύο κανόνες που δεν διαπραγματεύονται
 *
 * 1. **Σταματά στο πρώτο ΜΟΝΟΣΗΜΑΝΤΟ.** Ένα πέρασμα με δύο υποψήφιους δεν αποφασίζει — δοκιμάζει
 *    το επόμενο, που μπορεί να διαλέξει. Αν κανένα δεν καταλήξει σε έναν, η αναφορά γίνεται
 *    **διφορούμενη** και ρωτά τον χρήστη. **Ποτέ μαντεψιά.**
 * 2. **Ένα αρχείο ανήκει σε ΜΙΑ αναφορά.** Αν δύο αναφορές διεκδικήσουν το ίδιο αρχείο, **καμία**
 *    δεν το παίρνει αυτόματα· και οι δύο γίνονται διφορούμενες. Αλλιώς δύο σαρώσεις με ίδιες
 *    διαστάσεις (`diatagma_1993` και `diatagma_1994`, και μόνο η μία δοσμένη) θα κατέληγαν να
 *    δείχνουν **και οι δύο** την ίδια — λάθος εικόνα σε λάθος θέση, **σιωπηλά**. Το «δεν ξέρω»
 *    είναι ασύγκριτα φθηνότερο από το «λάθος με σιγουριά».
 *
 * @see ./shared/foreign-asset-basename.ts — το ΕΝΑ basename SSoT (μην γράψεις τέταρτο)
 * @see ./shared/foreign-asset-pixel-size.ts — το πέρασμα 4
 * @see ./dxf-external-reference-resolver.ts — ο καταναλωτής (ανέβασμα + ενημέρωση αναφορών)
 */

import type { DxfExternalReference } from '../types/dxf-external-reference';
import { foreignAssetBasename, foreignAssetBasenameKey } from './shared/foreign-asset-basename';

/** Ποιο πέρασμα αποφάσισε — ταξιδεύει στο UI ώστε ο χρήστης να ξέρει **γιατί** ταιριάξαμε. */
export type ReferenceMatchReason =
  | 'exact-name'
  | 'case-insensitive-name'
  | 'stem'
  | 'pixel-size';

/** Μια αναφορά που βρήκε **ακριβώς ένα** αρχείο. */
export interface ReferenceMatch {
  readonly refId: string;
  readonly file: File;
  readonly reason: ReferenceMatchReason;
}

/** Μια αναφορά που βρήκε **περισσότερα από ένα** — ο χρήστης αποφασίζει. */
export interface ReferenceAmbiguity {
  readonly refId: string;
  readonly reason: ReferenceMatchReason;
  readonly candidates: readonly File[];
}

export interface ReferenceMatchResult {
  readonly matched: readonly ReferenceMatch[];
  readonly ambiguous: readonly ReferenceAmbiguity[];
  /** Ids αναφορών που κανένα πέρασμα δεν άγγιξε. **Φυσιολογική κατάσταση**, όχι σφάλμα. */
  readonly unmatchedRefIds: readonly string[];
}

export interface ReferenceMatchDeps {
  /** Διαστάσεις σε pixels ενός αρχείου, ή `null` όταν δεν αποκωδικοποιείται. */
  readonly pixelSizeOf: (file: File) => Promise<{ x: number; y: number } | null>;
}

/** Το όνομα χωρίς την τελευταία κατάληξη, σε πεζά. `αρχείο.tar.gz` → `αρχείο.tar` (σκόπιμα). */
function stemKey(name: string): string {
  const base = foreignAssetBasename(name);
  const dot = base.lastIndexOf('.');
  return (dot > 0 ? base.slice(0, dot) : base).toLowerCase();
}

/** Κλειδί ταύτισης διαστάσεων. Ακέραιοι — ένα pixel είναι αδιαίρετο. */
const sizeKey = (size: { x: number; y: number }): string => `${Math.round(size.x)}x${Math.round(size.y)}`;

/**
 * Οι αναφορές που **μπορούν** να επιλυθούν: μόνο raster, και μόνο όσες δεν έχουν ήδη αρχείο.
 *
 * Τα υπόλοιπα είδη (xref / underlay / OLE / data link) **ανιχνεύονται και εμφανίζονται**, αλλά
 * δεν αποδίδονται (Απόφαση 4). Το να τα «ταυτίζαμε» θα ήταν ψέμα: δεν έχουμε τι να κάνουμε με
 * το αρχείο όταν το βρούμε.
 */
export function isResolvableReference(ref: DxfExternalReference): boolean {
  return ref.kind === 'raster' && ref.status !== 'resolved';
}

/** Όλα τα ευρετήρια χτίζονται **μία φορά**, όχι μία ανά αναφορά (10 αναφορές × 200 αρχεία). */
interface CandidateIndex {
  readonly byExactName: Map<string, File[]>;
  readonly byNameKey: Map<string, File[]>;
  readonly byStem: Map<string, File[]>;
  readonly bySize: Map<string, File[]>;
}

function pushInto(map: Map<string, File[]>, key: string, file: File): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(file);
  else map.set(key, [file]);
}

async function buildCandidateIndex(
  files: readonly File[],
  deps: ReferenceMatchDeps,
): Promise<CandidateIndex> {
  const index: CandidateIndex = {
    byExactName: new Map(),
    byNameKey: new Map(),
    byStem: new Map(),
    bySize: new Map(),
  };
  for (const file of files) {
    pushInto(index.byExactName, foreignAssetBasename(file.name), file);
    pushInto(index.byNameKey, foreignAssetBasenameKey(file.name), file);
    pushInto(index.byStem, stemKey(file.name), file);
    // `null` (μη-εικόνα, TIFF, περιβάλλον χωρίς decoder) ⇒ το αρχείο απλώς δεν συμμετέχει στο
    // πέρασμα 4. Δεν είναι σφάλμα και δεν εμποδίζει τα περάσματα ονόματος.
    const size = await deps.pixelSizeOf(file);
    if (size) pushInto(index.bySize, sizeKey(size), file);
  }
  return index;
}

/** Οι υποψήφιοι κάθε περάσματος, με τη σειρά της σκάλας. */
function candidatesPerPass(
  ref: DxfExternalReference,
  index: CandidateIndex,
): Array<{ reason: ReferenceMatchReason; files: readonly File[] }> {
  return [
    { reason: 'exact-name', files: index.byExactName.get(ref.basename) ?? [] },
    { reason: 'case-insensitive-name', files: index.byNameKey.get(foreignAssetBasenameKey(ref.basename)) ?? [] },
    { reason: 'stem', files: index.byStem.get(stemKey(ref.basename)) ?? [] },
    {
      reason: 'pixel-size',
      files: ref.imageSizePx ? index.bySize.get(sizeKey(ref.imageSizePx)) ?? [] : [],
    },
  ];
}

/** Το αποτέλεσμα μιας αναφοράς **πριν** τον έλεγχο αποκλειστικότητας. */
type Provisional =
  | { readonly kind: 'match'; readonly match: ReferenceMatch }
  | { readonly kind: 'ambiguous'; readonly ambiguity: ReferenceAmbiguity }
  | { readonly kind: 'none' };

function decideOne(ref: DxfExternalReference, index: CandidateIndex): Provisional {
  let firstAmbiguity: ReferenceAmbiguity | null = null;
  for (const { reason, files } of candidatesPerPass(ref, index)) {
    if (files.length === 1) return { kind: 'match', match: { refId: ref.id, file: files[0], reason } };
    // Δύο υποψήφιοι εδώ δεν σταματούν τη σκάλα: το επόμενο, **στενότερο** πέρασμα μπορεί να
    // διαλέξει. Κρατάμε όμως το ΠΡΩΤΟ (ισχυρότερο) σύνολο για να το δείξουμε αν κανένα δεν λύσει.
    if (files.length > 1 && !firstAmbiguity) {
      firstAmbiguity = { refId: ref.id, reason, candidates: files };
    }
  }
  return firstAmbiguity ? { kind: 'ambiguous', ambiguity: firstAmbiguity } : { kind: 'none' };
}

/**
 * Ταυτίζει αναφορές με αρχεία. Καθαρή ως προς τις εισόδους — δεν μεταλλάσσει τίποτα και δεν
 * αγγίζει δίκτυο.
 */
export async function matchExternalReferences(
  refs: readonly DxfExternalReference[],
  files: readonly File[],
  deps: ReferenceMatchDeps,
): Promise<ReferenceMatchResult> {
  const resolvable = refs.filter(isResolvableReference);
  if (resolvable.length === 0 || files.length === 0) {
    return { matched: [], ambiguous: [], unmatchedRefIds: resolvable.map((r) => r.id) };
  }

  const index = await buildCandidateIndex(files, deps);
  const provisional = resolvable.map((ref) => ({ ref, outcome: decideOne(ref, index) }));

  // ── Αποκλειστικότητα: ένα αρχείο, μία αναφορά (βλ. κανόνα 2 στην κεφαλίδα) ──
  const claimCount = new Map<File, number>();
  for (const { outcome } of provisional) {
    if (outcome.kind === 'match') {
      claimCount.set(outcome.match.file, (claimCount.get(outcome.match.file) ?? 0) + 1);
    }
  }

  const matched: ReferenceMatch[] = [];
  const ambiguous: ReferenceAmbiguity[] = [];
  const unmatchedRefIds: string[] = [];
  for (const { ref, outcome } of provisional) {
    if (outcome.kind === 'match') {
      if ((claimCount.get(outcome.match.file) ?? 0) > 1) {
        // Δύο αναφορές, ένα αρχείο: ο resolver **δεν μαντεύει** ποια το δικαιούται.
        ambiguous.push({
          refId: ref.id,
          reason: outcome.match.reason,
          candidates: [outcome.match.file],
        });
      } else {
        matched.push(outcome.match);
      }
    } else if (outcome.kind === 'ambiguous') {
      ambiguous.push(outcome.ambiguity);
    } else {
      unmatchedRefIds.push(ref.id);
    }
  }
  return { matched, ambiguous, unmatchedRefIds };
}

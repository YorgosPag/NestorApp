/**
 * @fileoverview **Το ΕΝΑ test double των τεσσάρων κεφαλιών του δημόσιου ραφιού** (εικόνες · μοντέλα · βίντεο · έδαφος).
 * @module test-utils/public-shelf-double
 * @related ADR-845 · ADR-907 §10 · ADR-920 Β3β · services/listings/publish-public-listing-shelf.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: ΤΑ TESTS ΧΤΥΠΟΥΣΑΝ ΠΡΑΓΜΑΤΙΚΟ GCS (μετρημένο 2026-10-25)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κάθε αποθήκευση αγγελίας καταλήγει στο `writeWithShelf`, που καλεί τα τέσσερα κεφάλια. Τα **αληθινά**
 * κεφάλια ζητούν κάδο από το `getAdminStorage()` — και σε μηχάνημα με Application Default Credentials
 * το Admin SDK **συνδέεται στ' αλήθεια** στο Google Cloud Storage, με τα διαπιστευτήρια του ανθρώπου, για
 * τον κάδο `test-project-public-media` (απαντά «does not exist» ⇒ `failed`, που το test δεν ελέγχει).
 *
 * Μέτρηση (`set-mandate-guard` Θ0, χρονομέτρηση ανά κεφάλι): **4,3–19 s** η πρώτη αποθήκευση (OAuth +
 * TLS κρύα, παράλληλα και τα τέσσερα), **0,3–0,5 s** κάθε επόμενη· με το double **χιλιοστά**. Το cpu-prof
 * έδειξε ~15 s **αδράνεια** — αναμονή δικτύου, όχι CPU. ⚠️ Το `STORAGE_EMULATOR_HOST` προς κλειστή θύρα
 * **δεν** είναι δίχτυ: ο πελάτης ξαναδοκιμάζει το `ECONNREFUSED` με backoff (μετρήθηκε ~15 s).
 *
 * Ζούσε ως **18 αντίγραφα** των ίδιων τεσσάρων `jest.mock`, και όποιο test το ξεχνούσε ήταν αργό και
 * ασταθές υπό φόρτο (timeout στα 10 s) — χωρίς να λέει γιατί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΧΡΗΣΗ — ΜΙΑ ΓΡΑΜΜΗ, ΠΡΩΤΟ IMPORT
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ```ts
 * import { publicShelfDouble } from '@/test-utils/public-shelf-double';
 * ```
 *
 * Η φόρτωση του module **δηλώνει** τα τέσσερα mocks (το μητρώο mocks του jest είναι ενιαίο για το
 * αρχείο test), γι' αυτό πρέπει να φορτωθεί **πριν** από οποιονδήποτε κώδικα που τα εισάγει — δηλαδή
 * **πρώτο import** (τα `jest.mock` του ίδιου του test ανεβαίνουν έτσι κι αλλιώς πάνω από αυτό).
 *
 * Προεπιλογή: κάθε κεφάλι απαντά `reconciled`, χωρίς δημοσιευμένα. Σουίτα που **ρωτά** το ράφι
 * χρησιμοποιεί τους καταγραφείς: `publicShelfDouble.image.mock.calls`, `.mockResolvedValueOnce(...)`.
 * Το `jest.clearAllMocks()` κρατά την προεπιλογή· μετά από `mockReset()` την επαναφέρει το
 * {@link resetPublicShelfDouble}.
 *
 * ⚠️ **ΜΗΝ** ξαναγράψεις `jest.mock` κεφαλιού σε test: μετά το import αυτού του module **θα το
 * αντικαταστήσει** (το τελευταίο `jest.mock` κερδίζει). Η συμπεριφορά αλλάζει **μέσω** των καταγραφέων.
 */

import type { PublicShelfKind } from '@/services/upload/utils/public-shelf-kinds';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import type { PublicShelfReport } from '@/services/listings/public-shelf.service';
import type { PublicShelfModelReport } from '@/services/listings/public-shelf-model.service';
import type { PublicShelfVideoReport } from '@/services/listings/public-shelf-video.service';
import type { PublicShelfTerrainReport } from '@/services/listings/public-shelf-terrain.service';

/** Τα ορίσματα **κάθε** κεφαλιού — είδος · ταυτότητα · πηγές. */
export type ShelfCall = [kind: PublicShelfKind<unknown>, subjectId: string, sources: readonly PublicShelfSource<unknown>[]];

/** Η απάντηση «συμφιλιώθηκε, τίποτα δημοσιευμένο» — κοινή σε όλα τα κεφάλια (κενό `published`). */
export function reconciledShelf(): { outcome: 'reconciled'; published: never[]; removed: number; rejected: number } {
  return { outcome: 'reconciled', published: [], removed: 0, rejected: 0 };
}

/** Οι τέσσερις καταγραφείς, ένας ανά κεφάλι. */
export const publicShelfDouble = {
  image: jest.fn<Promise<PublicShelfReport<unknown>>, ShelfCall>(),
  model: jest.fn<Promise<PublicShelfModelReport>, ShelfCall>(),
  video: jest.fn<Promise<PublicShelfVideoReport>, ShelfCall>(),
  terrain: jest.fn<Promise<PublicShelfTerrainReport>, ShelfCall>(),
};

/** Επαναφέρει καταγραφές **και** προεπιλογή (`reconciled`) και στα τέσσερα. */
export function resetPublicShelfDouble(): void {
  for (const head of Object.values(publicShelfDouble)) {
    head.mockReset();
    head.mockImplementation(async () => reconciledShelf());
  }
}

resetPublicShelfDouble();

jest.mock('@/services/listings/public-shelf.service', () => ({
  reconcilePublicShelf: (...args: ShelfCall) => publicShelfDouble.image(...args),
}));
jest.mock('@/services/listings/public-shelf-model.service', () => ({
  reconcilePublicModelShelf: (...args: ShelfCall) => publicShelfDouble.model(...args),
}));
jest.mock('@/services/listings/public-shelf-video.service', () => ({
  reconcilePublicVideoShelf: (...args: ShelfCall) => publicShelfDouble.video(...args),
}));
jest.mock('@/services/listings/public-shelf-terrain.service', () => ({
  reconcilePublicTerrainShelf: (...args: ShelfCall) => publicShelfDouble.terrain(...args),
}));

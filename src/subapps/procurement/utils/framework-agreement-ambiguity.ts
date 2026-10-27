/**
 * Ισοπαλία Συμβάσεων-Πλαίσιο κατά την αποθήκευση — ADR-923 §5.11 «3γ» (Βήμα 2)
 *
 * SAP: δύο εγγραφές συνθήκης με το ίδιο κλειδί και επικαλυπτόμενη ισχύ **δεν** επιτρέπονται· ο κατάλογος
 * αρνείται ήδη ασαφείς συνθήκες (`findAmbiguousConditions`). Εδώ η ίδια αρχή για τις συμβάσεις, με μία
 * διαφορά: η ασάφεια **δεν** κρίνεται με δεύτερη, δομική σύγκριση εύρους. Εκτελείται ο **ΙΔΙΟΣ**
 * `selectLineAgreement` που τιμολογεί τις PO, πάνω σε αντιπροσωπευτικές γραμμές ⇒ η προειδοποίηση είναι
 * αποδεδειγμένα ό,τι θα έκανε η τιμολόγηση, όχι μια δεύτερη γνώμη που μπορεί να αποκλίνει.
 *
 * 🔑 **Γιατί αρκούν αυτά τα σημεία ελέγχου.** Ισοπαλία = ίση ειδικότητα `[γραμμή, έργο]`. Ανά έργο της
 * λίστας (ή ένα φρουρό «οποιοδήποτε έργο» όταν `null`):
 *   - κάθε υλικό της ⇒ `(υλικό, φρουρός)`: η ειδικότητα 2 δεν εξαρτάται από την κατηγορία·
 *   - κάθε κατηγορία της ⇒ `(null, κατηγορία)`: γραμμή της κατηγορίας με υλικό εκτός κάθε λίστας·
 *   - «όλα» ⇒ `(null, φρουρός)`.
 * Ο φρουρός δεν ανήκει σε **καμία** λίστα (το zod απαιτεί μη κενές τιμές) ⇒ σε αυτά τα σημεία καμία τρίτη
 * σύμβαση δεν μπορεί να είναι ειδικότερη από όσο είναι πουθενά αλλού. Άρα τα σημεία δεν «κρύβουν» ισοπαλία
 * που υπάρχει σε πραγματική γραμμή, ούτε δείχνουν ισοπαλία που δεν θα συνέβαινε ποτέ.
 *
 * 🔑 **Χρόνος.** Αφού καμία τρίτη δεν κυριαρχεί στα σημεία, ισοπαλία με την άλλη = επικάλυψη ισχύος. Η
 * πρώτη κοινή στιγμή είναι η μεταγενέστερη από τις δύο αρχές· εκεί ρωτιέται ο επιλογέας.
 *
 * 🔑 Η ελεγχόμενη σύμβαση θεωρείται **ενεργή** («θα συγκρουστεί αν ενεργοποιηθεί»)· ο εαυτός της
 * (η αποθηκευμένη εκδοχή στην επεξεργασία) εξαιρείται. Το αν η ισοπαλία **μπλοκάρει** το αποφασίζει ο
 * καλών (μόνο για ενεργή — `framework-agreement-scope-guard`).
 *
 * **Layering**: καθαρές συναρτήσεις, μηδέν I/O — ίδιες σε server και φόρμα.
 */

import { windowsOverlap } from '@/lib/pricing/validity';
import type { FrameworkAgreementLike } from '../types/framework-agreement';
import { faValidity, selectLineAgreement, type FaLineContext } from './framework-agreement-discount';

/** Τιμή που δεν ανήκει σε καμία λίστα εύρους (οι λίστες έχουν μόνο μη κενές ταυτότητες). */
const OUTSIDE_EVERY_LIST = '\u0000';

/** Πού και από πότε η ελεγχόμενη σύμβαση ισοβαθμεί με άλλη. `null` = «οποιοδήποτε». */
export interface AgreementTiePoint {
  readonly materialId: string | null;
  readonly categoryCode: string | null;
  readonly projectId: string | null;
  readonly fromMs: number;
}

export interface AgreementTie {
  readonly agreementId: string;
  readonly agreementNumber: string;
  readonly points: readonly AgreementTiePoint[];
}

type ProbeLine = Omit<FaLineContext, 'supplierId'>;

function itemProbes(fa: FrameworkAgreementLike): Omit<ProbeLine, 'projectId'>[] {
  const materials = fa.applicableMaterialIds;
  const categories = fa.applicableAtoeCategoryCodes;
  if (materials === null && categories === null) return [{ materialId: null, categoryCode: OUTSIDE_EVERY_LIST }];
  return [
    ...(materials ?? []).map((materialId) => ({ materialId, categoryCode: OUTSIDE_EVERY_LIST })),
    ...(categories ?? []).map((categoryCode) => ({ materialId: null, categoryCode })),
  ];
}

/** Οι αντιπροσωπευτικές γραμμές της σύμβασης (βλ. επικεφαλίδα). */
function probeLines(fa: FrameworkAgreementLike): ProbeLine[] {
  const projects = fa.applicableProjectIds ?? [OUTSIDE_EVERY_LIST];
  return projects.flatMap((projectId) => itemProbes(fa).map((item) => ({ ...item, projectId })));
}

/** Η πρώτη κοινή στιγμή ισχύος, ή `null` αν δεν επικαλύπτονται / δεν διαβάζονται. */
function firstSharedInstant(draft: FrameworkAgreementLike, other: FrameworkAgreementLike): number | null {
  const draftWindow = faValidity(draft);
  const otherWindow = faValidity(other);
  if (draftWindow === null || otherWindow === null || !windowsOverlap(draftWindow, otherWindow)) return null;
  return Math.max(draftWindow.fromMs ?? Number.MIN_SAFE_INTEGER, otherWindow.fromMs ?? Number.MIN_SAFE_INTEGER);
}

function tiePoint(line: ProbeLine, fromMs: number): AgreementTiePoint {
  const unwrap = (value: string | null) => (value === OUTSIDE_EVERY_LIST ? null : value);
  return {
    materialId: line.materialId,
    categoryCode: unwrap(line.categoryCode),
    projectId: unwrap(line.projectId),
    fromMs,
  };
}

/** Ο επιλογέας σε κάθε (γραμμή × στιγμή): ισοπαλία που περιέχει την ελεγχόμενη ⇒ σημείο για κάθε άλλη. */
function collectTiePoints(
  probe: FrameworkAgreementLike,
  others: readonly FrameworkAgreementLike[],
  instants: readonly number[],
): Map<string, AgreementTiePoint[]> {
  const pointsById = new Map<string, AgreementTiePoint[]>();
  const all = [probe, ...others];
  for (const line of probeLines(probe)) {
    for (const atMs of instants) {
      const selection = selectLineAgreement(all, { ...line, supplierId: probe.vendorContactId }, atMs);
      if (selection.kind !== 'ambiguous' || !selection.tiedIds.includes(probe.id)) continue;
      const point = tiePoint(line, atMs);
      for (const id of selection.tiedIds) {
        if (id === probe.id) continue;
        const points = pointsById.get(id) ?? [];
        // Οι στιγμές είναι αύξουσες ⇒ κρατιέται η ΠΡΩΤΗ στιγμή κάθε γραμμής.
        const seen = points.some(
          (p) => p.materialId === point.materialId && p.categoryCode === point.categoryCode && p.projectId === point.projectId,
        );
        if (!seen) pointsById.set(id, [...points, point]);
      }
    }
  }
  return pointsById;
}

/**
 * Οι συμβάσεις με τις οποίες η `draft` θα ισοβαθμούσε σε κάποια γραμμή PO, κάποια στιγμή — ταξινομημένες
 * κατά αριθμό σύμβασης. Κενό ⇒ καμία ασάφεια.
 */
export function findAgreementTies(
  draft: FrameworkAgreementLike,
  agreements: readonly FrameworkAgreementLike[],
): AgreementTie[] {
  const probe: FrameworkAgreementLike = { ...draft, status: 'active', isDeleted: false };
  const others = agreements.filter((fa) => fa.id !== draft.id);
  const instants = [...new Set(others.map((fa) => firstSharedInstant(probe, fa)).filter((ms): ms is number => ms !== null))].sort(
    (a, b) => a - b,
  );
  const pointsById = collectTiePoints(probe, others, instants);
  return others
    .filter((fa) => pointsById.has(fa.id))
    .map((fa) => ({ agreementId: fa.id, agreementNumber: fa.agreementNumber, points: pointsById.get(fa.id) ?? [] }))
    .sort((a, b) => a.agreementNumber.localeCompare(b.agreementNumber));
}

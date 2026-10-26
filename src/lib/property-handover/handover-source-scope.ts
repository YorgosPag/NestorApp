/**
 * @fileoverview **Από πού έρχεται ένα παραδοτέο αρχείο** — της μονάδας, ή **κοινό** του κτιρίου / του έργου (ADR-916 Φ-Γ3 · Ο2).
 * @related lib/property-handover/handover-disposition.ts (η κρίση: τα κοινά παραδίδονται ΜΟΝΟ αν δηλώθηκαν) ·
 *          lib/property-handover/file-handover-origin.ts (`sourceScope` στο αντίγραφο) · ADR-916 §5.25
 * @module lib/property-handover/handover-source-scope
 *
 * 🔑 **Γιατί δύο σύνολα κανόνων**: ένα αρχείο της **μονάδας** αφορά τον αγοραστή της· ένα αρχείο του **κτιρίου/έργου** αφορά
 *    **όλους** τους αγοραστές του — και κουβαλά συχνά δεδομένα **τρίτων** (ο τίτλος του οικοπέδου με τους οικοπεδούχους,
 *    συμβάσεις υπεργολάβων, τιμολόγια). Η ΗΤΚ (ν. 4495/2017) ορίζει ήδη ποια έγγραφα του κτιρίου ανήκουν στον φάκελο της
 *    διηρημένης ιδιοκτησίας (στέλεχος άδειας · σχέδια · πίνακας χιλιοστών) ⇒ τα κοινά φεύγουν **μόνο** με ρητή δήλωση
 *    (`sharedHandover`) — όπως το ISO 19650-3 ζητά από τον κάτοχο να **ορίσει** τι πληροφορία θέλει (AIR), όχι «όλα».
 * ⛔ **Όροφος**: ΔΕΝ είναι πηγή. Οι κατόψεις ορόφου είναι σχέδια εργασίας (DXF), όχι το εγκεκριμένο σύνολο της άδειας.
 *
 * **Layering**: leaf — κανένα SDK.
 */

import { ENTITY_TYPES } from '@/config/domain-constants';

/** Τα κλειστά επίπεδα προέλευσης — `unit` = το ακίνητο ή ένα παρακολούθημά του (ό,τι ίσχυε πριν τη Φ-Γ3). */
export const HANDOVER_SOURCE_SCOPES = ['unit', 'building', 'project'] as const;
export type HandoverSourceScope = (typeof HANDOVER_SOURCE_SCOPES)[number];

/** Τα **κοινά** επίπεδα — οντότητα → επίπεδο. Ο ΕΝΑΣ πίνακας που ρωτούν η κρίση, το σύνολο, ο γραφέας και το αντίγραφο. */
const SHARED_SCOPE_OF_ENTITY: Readonly<Record<string, Exclude<HandoverSourceScope, 'unit'>>> = {
  [ENTITY_TYPES.BUILDING]: 'building',
  [ENTITY_TYPES.PROJECT]: 'project',
};

/** **Από πού** — κάθε οντότητα που δεν είναι κτίριο/έργο είναι της μονάδας (μόνο αυτές φτάνουν ως εδώ, βλ. το σύνολο). */
export function handoverSourceScopeOf(entityType: string): HandoverSourceScope {
  return SHARED_SCOPE_OF_ENTITY[entityType] ?? 'unit';
}

/** **Κοινό** αρχείο — αφορά κάθε αγοραστή του κτιρίου/έργου, όχι μόνο αυτής της πώλησης. */
export function isSharedHandoverSource(entityType: string): boolean {
  return handoverSourceScopeOf(entityType) !== 'unit';
}

/** Διαβάζει αποθηκευμένη τιμή — απούσα ⇒ `unit` (κάθε αντίγραφο πριν τη Φ-Γ3 ήταν της μονάδας). Άγνωστη ⇒ `null`. */
export function readHandoverSourceScope(raw: unknown): HandoverSourceScope | null {
  if (raw === undefined || raw === null) return 'unit';
  return HANDOVER_SOURCE_SCOPES.find((scope) => scope === raw) ?? null;
}

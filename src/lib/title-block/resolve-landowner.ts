/**
 * @fileoverview Λ2 — «ΕΡΓΟΔΟΤΗΣ» → υποψήφιος **οικοπεδούχος** (ADR-745 Φ3β, §9 Q1).
 *
 * 🔴 **Το «ΕΡΓΟΔΟΤΗΣ» της πινακίδας ΔΕΝ είναι ο εργοδότης.** Την εντολή στον τοπογράφο την
 * έδωσε και την πλήρωσε η εταιρεία μας, που **δεν εμφανίζεται πουθενά** στην πινακίδα. Το
 * πρόσωπο που γράφεται εκεί είναι ο **ιδιοκτήτης του οικοπέδου**: το τοπογραφικό συντάσσεται στο
 * όνομά του γιατί αφορά **το δικό του** ακίνητο και θα προσαρτηθεί στο συμβόλαιο όπου εκείνος
 * είναι ο **πωλητής** (απόφαση Giorgio, 2026-08-04 — κλειστή).
 *
 * ⇒ Προορισμός: `Project.landowners[]` με `acquisitionStatus: 'prospective'`, ως **πρόταση**.
 * 🔴 **ΠΟΤΕ `Project.client`**: τυπώνεται σε PDF προβολής ως «Πελάτης» και θα διαφήμιζε την
 * αντισυμβαλλόμενη πωλήτρια ως πελάτισσά μας.
 *
 * @module lib/title-block/resolve-landowner
 */

import { personNameMatch } from '@/utils/greek-person-name';
import type {
  BindingCandidate,
  BindingEvidence,
  BindingProposal,
} from '@/types/title-block-binding';
import { compareBindingCandidates } from '@/types/title-block-binding';
import type { TitleBlockField } from '@/types/title-block-reading';
import type { ContactSnapshotEntry } from './resolve-people';

/**
 * Η κατάσταση με την οποία μπαίνει ένας οικοπεδούχος **από την πινακίδα**.
 *
 * Ποτέ ψηλότερη: η πινακίδα αποδεικνύει ότι κάποιος ήταν ιδιοκτήτης **τη στιγμή της μελέτης** —
 * δεν αποδεικνύει καμία υπογραφή. Το `under_contract`/`secured` προϋποθέτει έγγραφο που ο
 * Νέστωρ δεν έχει δει.
 */
const STATUS_FROM_TITLE_BLOCK = 'prospective' as const;

export interface LandownerResolveContext {
  readonly projectId: string;
  readonly titleBlockIndex: number;
  readonly contacts: readonly ContactSnapshotEntry[];
}

/**
 * Ο «ΕΡΓΟΔΟΤΗΣ» δίνει **μόνο όνομα** — καμία άλλη μαρτυρία δεν υπάρχει στο κελί.
 *
 * Γι' αυτό το κατώφλι του `personNameMatch` (δύο συστατικά, χωρίς προσεγγιστικό σε σύντομα
 * επώνυμα) είναι εδώ ο **μοναδικός** φύλακας — και ο λόγος που είναι αυστηρό.
 */
function nameEvidence(value: string, contact: ContactSnapshotEntry): BindingEvidence[] {
  const match = personNameMatch(value, contact.displayName);
  if (match === 'exact') return [{ kind: 'name-exact', value: contact.displayName }];
  if (match === 'abbrev') return [{ kind: 'name-abbrev', value: contact.displayName }];
  if (match === 'fuzzy') return [{ kind: 'name-fuzzy', value: contact.displayName }];
  return [];
}

export function resolveLandownerProposal(
  field: TitleBlockField,
  context: LandownerResolveContext,
): BindingProposal {
  const base = {
    fieldKey: field.key,
    titleBlockIndex: context.titleBlockIndex,
    sourceHandle: field.sourceHandle,
    labelHandle: field.labelHandle,
    snapshotValue: field.rawValue,
    personName: field.rawValue,
  } as const;

  const candidates: BindingCandidate[] = [];
  for (const contact of context.contacts) {
    const evidence = nameEvidence(field.rawValue, contact);
    if (evidence.length === 0) continue;
    candidates.push({
      target: {
        kind: 'landowner',
        projectId: context.projectId,
        contactId: contact.id,
        acquisitionStatus: STATUS_FROM_TITLE_BLOCK,
      },
      label: contact.displayName,
      evidence,
    });
  }

  if (candidates.length === 0) return { ...base, candidates: [], blockedBy: 'no-match' };
  return { ...base, candidates: [...candidates].sort(compareBindingCandidates) };
}

/**
 * =============================================================================
 * Conveyance — ο ΚΡΙΤΗΣ του transmittal: «μπορεί ΑΥΤΟΣ ο ρόλος να στείλει ΕΔΩ, ΤΩΡΑ;» (ADR-901 Φ4.4)
 * =============================================================================
 *
 * Τρεις άξονες, **κανένας** αποθηκευμένος:
 * 1. **Γραμμή**: δέχεται transmittal μόνο γραμμή με matcher επιπέδου `contribution` (ο κατάλογος, όχι δεύτερη λίστα).
 * 2. **Ρόλος**: ο πάροχος της γραμμής (`lawyer` → δικηγόροι · `notary` → συμβολαιογράφος) **και** ορατότητα στον ρόλο.
 * 3. **Κατάσταση**: `CONTRIBUTION_STATES_BY_ROLE` (πάγωμα Ε-6 / Α9 — ο δικηγόρος σταματά στην υπογραφή).
 *
 * Κάθε «όχι» έχει **όνομα** (κλειστό σύνολο) — ο γραφέας το μεταφράζει σε HTTP, το UI σε μήνυμα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις (server · client · άγκυρες).
 *
 * @module lib/conveyance/contribution-policy
 */

import { CONTRIBUTION_STATES_BY_ROLE } from '@/config/engagement-policy';
import type { ChecklistItem, ChecklistProvider } from '@/config/conveyance-checklist/types';
import type { ConveyanceCaseState } from '@/types/conveyance-case';
import type { LegalProfessionalRole } from '@/types/legal-contracts';

/** Ποιοι ρόλοι **παρέχουν** τα έγγραφα ενός παρόχου του καταλόγου — το ΕΝΑ σημείο της αντιστοίχισης. */
const CONTRIBUTOR_ROLES: Readonly<Partial<Record<ChecklistProvider, readonly LegalProfessionalRole[]>>> = {
  lawyer: ['seller_lawyer', 'buyer_lawyer'],
  notary: ['notary'],
};

function contributorRolesOf(provider: ChecklistProvider): readonly LegalProfessionalRole[] {
  return CONTRIBUTOR_ROLES[provider] ?? [];
}

/** Τα entry points (της υπόθεσης) μέσω των οποίων ικανοποιείται η γραμμή με transmittal — κενό ⇒ δεν δέχεται. */
export function contributionEntryPointIds(item: ChecklistItem): readonly string[] {
  if (item.satisfaction.kind !== 'files') return [];
  return item.satisfaction.matchers.filter((m) => m.level === 'contribution').flatMap((m) => m.entryPointIds);
}

/** Στέλνει αυτός ο ρόλος σε αυτή την κατάσταση υπόθεσης; (μόνο ο άξονας του χρόνου) */
export function roleContributesIn(role: LegalProfessionalRole, state: ConveyanceCaseState): boolean {
  return CONTRIBUTION_STATES_BY_ROLE[role].includes(state);
}

export type ContributionRefusal =
  /** Η γραμμή δεν δέχεται transmittal (δεν έχει matcher `contribution`). */
  | 'not-contributable'
  /** Ο ρόλος δεν είναι πάροχος της γραμμής ή δεν τη βλέπει. */
  | 'role-not-provider'
  /** Η κατάσταση της υπόθεσης δεν επιτρέπει αποστολή σε αυτόν τον ρόλο (πάγωμα). */
  | 'case-frozen'
  /** Το entry point δεν ανήκει στη γραμμή. */
  | 'entry-point-mismatch';

type ContributionJudgement = { readonly ok: true } | { readonly ok: false; readonly refusal: ContributionRefusal };

interface ContributionQuestion {
  readonly role: LegalProfessionalRole;
  readonly state: ConveyanceCaseState;
  readonly item: ChecklistItem;
  readonly entryPointId: string;
}

/** Η μία κρίση — σειρά: γραμμή → ρόλος → χρόνος → entry point. */
export function judgeContribution(question: ContributionQuestion): ContributionJudgement {
  const { role, state, item, entryPointId } = question;
  const entryPoints = contributionEntryPointIds(item);
  if (entryPoints.length === 0) return { ok: false, refusal: 'not-contributable' };
  if (!contributorRolesOf(item.provider).includes(role) || !item.visibleTo.includes(role)) {
    return { ok: false, refusal: 'role-not-provider' };
  }
  if (!roleContributesIn(role, state)) return { ok: false, refusal: 'case-frozen' };
  if (!entryPoints.includes(entryPointId)) return { ok: false, refusal: 'entry-point-mismatch' };
  return { ok: true };
}

/** Οι γραμμές στις οποίες **αυτός** ο ρόλος μπορεί να στείλει **τώρα** — για το UI (ποιες γραμμές δείχνουν «Αποστολή»). */
export function contributableItemIds(
  role: LegalProfessionalRole,
  state: ConveyanceCaseState,
  items: readonly ChecklistItem[],
): readonly string[] {
  return items
    .filter((item) => {
      const [entryPointId] = contributionEntryPointIds(item);
      return entryPointId !== undefined && judgeContribution({ role, state, item, entryPointId }).ok;
    })
    .map((item) => item.id);
}

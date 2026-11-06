/**
 * ADR-929 Φ5.2ε — η πρόταση τοίχων **όπως είναι μετά την επιβεβαίωση του ανθρώπου**. Με τη μερική έγκριση
 * κανένας τοίχος δεν γράφεται πριν επιβεβαιωθεί η ομάδα πάχους του («πράσινο = θα γραφτεί»)· τα tests που
 * κρίνουν τι **χτίζεται** (γεωμετρία, ενώσεις, εγγραφή, κουφώματα στους γραμμένους τοίχους) ξεκινούν από εδώ.
 * ΕΝΑΣ ορισμός για όλες τις σουίτες — όχι αντίγραφα (CHECK 3.28).
 */

import type { WallCategory } from '../../types/wall-types';
import { computeWallProposal, type WallProposal, type WallProposalInput } from '../wall-proposal';

/** Ο άνθρωπος επιβεβαιώνει ΚΑΘΕ ομάδα πάχους με την προτεινόμενη λειτουργία (Δ3). */
export function confirmAsSuggested(proposal: Pick<WallProposal, 'groups'>): Map<number, WallCategory> {
  return new Map(proposal.groups.map((g) => [g.thicknessMm, g.suggestedCategory] as const));
}

/**
 * Η πρόταση με όλες τις ομάδες επιβεβαιωμένες. Ό,τι επέλεξε ρητά το test στο `categoryByThicknessMm`
 * υπερισχύει της πρότασης του βοηθού.
 */
export function proposeConfirmed(input: WallProposalInput): WallProposal {
  const chosen = confirmAsSuggested(computeWallProposal(input));
  for (const [thicknessMm, category] of input.categoryByThicknessMm ?? []) chosen.set(thicknessMm, category);
  return computeWallProposal({ ...input, categoryByThicknessMm: chosen });
}

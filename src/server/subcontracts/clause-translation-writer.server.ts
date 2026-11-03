import 'server-only';

/**
 * Ο γραφέας των **μεταφράσεων** ανά έκδοση ρήτρας (ADR-928 §5.2.2).
 *
 * 🔑 Η μετάφραση γράφεται πάνω στο **τρέχον** ελληνικό: παίρνει το `sourceHash` της έκδοσης, όχι κάτι που στέλνει ο
 * πελάτης. Η έγκριση ξανακρίνει την ισότητα (μπαγιάτικη ⇒ 409) και τη διάκριση καθηκόντων (ο μεταφραστής δεν εγκρίνει
 * τον εαυτό του). Το ελληνικό **υπερισχύει πάντα** — η μετάφραση δεν «μεταφράζει» την αυθεντία (`el` ⇒ 422).
 * @module server/subcontracts/clause-translation-writer.server
 */

import type { AuthContext } from '@/lib/auth';
import { generateDeterministicSubcontractClauseVersionId } from '@/services/enterprise-id.service';
import { refuseTranslationApproval, refuseTranslationProposal } from '@/subapps/procurement/subcontracts/clauses/clause-governance';
import { validateClauseTranslation } from '@/subapps/procurement/subcontracts/clauses/validate-clause-version';
import type { ClauseBody, ClauseTranslationOrigin, SubcontractClauseVersion } from '@/subapps/procurement/subcontracts/types/clause';
import type { ClauseLanguage } from '@/subapps/procurement/subcontracts/types/clause-parameter';
import type { VersionTarget } from './clause-governance-writer.server';
import { assertRevision, clauseVersionDocRef, readOwned, runSubcontractTransaction, stageUpdate, type SubcontractTx } from './subcontract-store.server';
import { assertGovernance, assertNoSubcontractIssues, SubcontractWriteError } from './subcontract-write-error';

/** Η έκδοση-στόχος με CAS — το ίδιο σημείο εισόδου και για τις δύο πράξεις. */
async function readVersion(scope: SubcontractTx, target: VersionTarget) {
  const ref = clauseVersionDocRef(scope.db, target.clauseId, generateDeterministicSubcontractClauseVersionId(target.clauseId, target.version));
  const version = await readOwned(scope, 'clauseVersion', ref);
  assertRevision(version, target.expectedRevision);
  return { ref, version };
}

export interface ProposeTranslationInput {
  readonly language: ClauseLanguage;
  readonly body: ClauseBody;
  readonly origin: ClauseTranslationOrigin;
}

/** Πρόχειρη μετάφραση (ανθρώπου ή μηχανής). Αντικαθιστά τυχόν προηγούμενη της ίδιας γλώσσας — ως πρόχειρο. */
export function proposeSubcontractClauseTranslation(ctx: AuthContext, target: VersionTarget, input: ProposeTranslationInput): Promise<SubcontractClauseVersion> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const { ref, version } = await readVersion(scope, target);
    assertGovernance(refuseTranslationProposal(version));
    assertNoSubcontractIssues(validateClauseTranslation(input.language, version.body, input.body));
    const translation = {
      body: input.body, status: 'draft' as const, origin: input.origin, sourceHash: version.sourceHash,
      proposedBy: ctx.uid, approvedBy: null, approvedAt: null,
    };
    return stageUpdate(scope, 'clauseVersion', ref, version, { translations: { ...version.translations, [input.language]: translation } });
  });
}

export function approveSubcontractClauseTranslation(ctx: AuthContext, target: VersionTarget, language: ClauseLanguage): Promise<SubcontractClauseVersion> {
  return runSubcontractTransaction(ctx, async (scope) => {
    const { ref, version } = await readVersion(scope, target);
    const translation = version.translations[language];
    if (!translation) throw new SubcontractWriteError('notFound');
    assertGovernance(refuseTranslationApproval(version, translation, ctx.uid));
    const approved = { ...translation, status: 'approved' as const, approvedBy: ctx.uid, approvedAt: scope.now };
    return stageUpdate(scope, 'clauseVersion', ref, version, { translations: { ...version.translations, [language]: approved } });
  });
}

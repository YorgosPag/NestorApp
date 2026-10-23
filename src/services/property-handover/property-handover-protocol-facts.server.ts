import 'server-only';

/**
 * @fileoverview **ΤΑ ΣΤΟΙΧΕΙΑ ΤΟΥ ΠΡΩΤΟΚΟΛΛΟΥ** — από πού έρχεται κάθε γραμμή του εγγράφου (ADR-916 Φ-Γ2 Σ4).
 * @related property-handover-protocol-write.service.ts (ο ένας γραφέας) · handover-protocol-view.ts (η όψη)
 * @module services/property-handover/property-handover-protocol-facts.server
 *
 * 🔑 **Κάθε στοιχείο από τον ΔΙΚΟ του SSoT — κανένα αντίγραφο**:
 *   - κείμενο ρητρών → η έκδοση **σε ισχύ** την ημέρα έκδοσης (`handoverProtocolTermsOn`)· φορέας → `operatorStatementOn`
 *   - πίνακας → το **καθολικό** (`readDeliveredRows`), και το αποτύπωμά του **ξαναϋπολογίζεται** εδώ: πρέπει να είναι αυτό που
 *     έκρινε το σχέδιο, αλλιώς το καθολικό κινήθηκε στο μεταξύ και τίποτα δεν εκδίδεται (`ledger-moved`)
 *   - εκδότης → νομική επωνυμία (`readCompanyLegalIdentity`), εφεδρεία το όνομα του χώρου· ακίνητο → `loadConveyanceSubject`
 *     (ο ίδιος αναγνώστης με την πρόσκληση)· παρακολουθήματα → `appurtenanceLabelOf` (ο ίδιος με τους φακέλους τους)
 *   - παραλήπτης → **μόνο** το ονοματεπώνυμο (`handoverRecipientNamesOf`, ο ίδιος αναγνώστης με καρτέλα και ειδοποίηση)· κανένα άλλο πεδίο επαφής δεν
 *     φεύγει από αυτό το αρχείο (ρήτρα `personalData`, GDPR άρθ. 5 §1 γ)
 * ⛔ **Άρνηση, όχι εικασία**: ό,τι λείπει από ένα **νομικό** έγγραφο (κείμενο · φορέας · εκδότης · ακίνητο) ⇒ ονομασμένη
 *    άρνηση. Ποτέ «—» στη θέση του εκδότη ενός σφραγισμένου εγγράφου.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { publicUrl } from '@/lib/http/public-origin';
import { handoverProtocolVerifyHref } from '@/lib/routes/legalRoutes';
import { operatorStatementOn, type OperatorStatementView } from '@/lib/platform-operator/operator-presentation';
import { handoverDeliveryDigest } from '@/lib/property-handover/handover-delivery-plan';
import type { HandoverProtocolPlan } from '@/lib/property-handover/handover-protocol-plan';
import {
  handoverProtocolIssueDayOf,
  handoverProtocolLegalTextHref,
  handoverProtocolTermsOn,
} from '@/lib/property-handover/handover-protocol-terms';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { handoverCopyRecordRef } from '@/server/property-handover-delivery/handover-delivery-copy.server';
import { appurtenanceLabelOf } from '@/server/property-handover-delivery/handover-delivery-dossiers.server';
import { readDeliveredRows } from '@/server/property-handover-delivery/handover-delivery-ledger.server';
import { readCompanyLegalIdentity } from '@/services/company/company-legal-identity';
import { loadConveyanceSubject } from '@/services/conveyance/conveyance-subject.server';
import {
  handoverProtocolViewOf,
  type HandoverProtocolLegalText,
  type HandoverProtocolRow,
  type HandoverProtocolView,
} from '@/services/pdf/renderers/handover-protocol/handover-protocol-view';
import type { PropertyHandover } from '@/types/property-handover';

import { handoverRecipientNamesOf } from './property-handover-recipient-name.server';

export type DueHandoverProtocol = Extract<HandoverProtocolPlan, { readonly kind: 'due' }>;

export type HandoverProtocolRefusal =
  | 'legal-text-none'
  | 'legal-text-missing-clauses'
  | 'operator-undeclared'
  | 'ledger-moved'
  | 'subject-missing'
  | 'issuer-unnamed';

export type HandoverProtocolFacts =
  | { readonly kind: 'ready'; readonly view: HandoverProtocolView }
  | { readonly kind: 'refused'; readonly reason: HandoverProtocolRefusal; readonly detail: string };

type Refused = Extract<HandoverProtocolFacts, { readonly kind: 'refused' }>;
const refused = (reason: HandoverProtocolRefusal, detail: string): Refused => ({ kind: 'refused', reason, detail });

interface ProtocolTerms {
  readonly legalText: HandoverProtocolLegalText;
  readonly operator: OperatorStatementView;
}

/** Κείμενο σε ισχύ + φορέας **της ημέρας έκδοσης** — ποτέ «το τελευταίο». */
function termsOn(issuedAt: string): ProtocolTerms | Refused {
  const day = handoverProtocolIssueDayOf(issuedAt);
  const terms = handoverProtocolTermsOn(day);
  if (terms.kind === 'none-in-force') return refused('legal-text-none', day);
  if (terms.kind === 'missing-clauses') return refused('legal-text-missing-clauses', terms.missing.join(','));
  const operator = operatorStatementOn(day);
  if (operator.kind !== 'declared') return refused('operator-undeclared', day);
  const { frozen, digest } = terms.version;
  const path = handoverProtocolLegalTextHref(frozen.version);
  return { legalText: { version: frozen.version, digest, text: frozen.locales.el, path, url: publicUrl(path) }, operator: operator.view };
}

/** Τα ονόματα των αντιγράφων όπως τα βλέπει ο αγοραστής — **μία** ανάγνωση· μόνο εγγραφές του ίδιου κατόχου. */
async function copyNamesOf(adminDb: AdminFirestore, recipientUserId: string, copyFileIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
  if (copyFileIds.length === 0) return new Map();
  const snaps = await adminDb.getAll(...copyFileIds.map((id) => handoverCopyRecordRef(adminDb, recipientUserId, id)));
  return new Map(snaps.flatMap((snap) => {
    const data = snap.data();
    const name: unknown = data?.displayName;
    return data?.userId === recipientUserId && typeof name === 'string' && name !== '' ? [[snap.id, name] as const] : [];
  }));
}

/** Οι γραμμές του πίνακα — **μόνο** αν το καθολικό δίνει ακόμη το αποτύπωμα που έκρινε το σχέδιο. */
async function tableOf(adminDb: AdminFirestore, handover: PropertyHandover, recipientUserId: string, plan: DueHandoverProtocol): Promise<readonly HandoverProtocolRow[] | null> {
  const rows = await readDeliveredRows(adminDb, handover);
  if ((await handoverDeliveryDigest(rows)) !== plan.ledgerDigest) return null;
  const names = await copyNamesOf(adminDb, recipientUserId, rows.map((row) => row.copyFileId));
  return rows.flatMap((row) => (row.sha256 === null ? [] : [{
    sourceFileId: row.sourceFileId, copyFileId: row.copyFileId, sha256: row.sha256, size: row.size, name: names.get(row.copyFileId) ?? null,
  }]));
}

interface ProtocolParties {
  readonly issuerName: string | null;
  readonly propertyLabel: string | null;
  readonly appurtenances: readonly string[];
  readonly recipientName: string | null;
}

/** Εκδότης · ακίνητο + παρακολουθήματα · παραλήπτης (μόνο ονοματεπώνυμο). `null` ⇒ το ακίνητο δεν είναι πια του μισθωτή. */
async function partiesOf(adminDb: AdminFirestore, handover: PropertyHandover): Promise<ProtocolParties | null> {
  const { companyId, propertyId, recipientContactId } = handover;
  const [subject, legal, workspaceName, names] = await Promise.all([
    loadConveyanceSubject(adminDb, companyId, propertyId),
    readCompanyLegalIdentity(companyId),
    readWorkspaceName(companyId),
    handoverRecipientNamesOf(adminDb, companyId, [recipientContactId]),
  ]);
  if (subject === null) return null;
  const appurtenances = await Promise.all(subject.subject.appurtenances.map((ref) => appurtenanceLabelOf(adminDb, ref)));
  const issuerName = legal?.businessName ?? legal?.tradeName ?? workspaceName.trim();
  return { issuerName: issuerName || null, propertyLabel: subject.propertyName, appurtenances, recipientName: names.get(recipientContactId) ?? null };
}

/** **Τα στοιχεία ενός οφειλόμενου Πρωτοκόλλου** — ή ονομασμένη άρνηση. */
export async function loadHandoverProtocolFacts(
  adminDb: AdminFirestore,
  handover: PropertyHandover,
  plan: DueHandoverProtocol,
  issuedAt: string,
): Promise<HandoverProtocolFacts> {
  const recipient = handover.recipient;
  const delivery = handover.fileDelivery;
  if (recipient === null || delivery === null) return refused('ledger-moved', handover.id);
  const terms = termsOn(issuedAt);
  if ('kind' in terms) return terms;
  const [rows, parties] = await Promise.all([tableOf(adminDb, handover, recipient.userId, plan), partiesOf(adminDb, handover)]);
  if (rows === null) return refused('ledger-moved', handover.id);
  if (parties === null) return refused('subject-missing', handover.propertyId);
  if (parties.issuerName === null) return refused('issuer-unnamed', handover.companyId);
  const verificationPath = handoverProtocolVerifyHref(plan.protocolId);
  const view = handoverProtocolViewOf({
    protocolId: plan.protocolId, revision: plan.revision, issuedAt, ledgerDigest: plan.ledgerDigest, rows,
    verification: { path: verificationPath, url: publicUrl(verificationPath) },
    supersedes: plan.supersedesProtocolId === null ? null : { protocolId: plan.supersedesProtocolId, revision: plan.revision - 1 },
    ...parties, issuerName: parties.issuerName,
    events: {
      saleCompletedAt: handover.completion?.at ?? null, invitationAcceptedAt: recipient.acceptedAt,
      deliveryStartedAt: delivery.startedAt, deliveryCompletedAt: delivery.completedAt,
    },
    ...terms,
  });
  return { kind: 'ready', view };
}

/**
 * ADR-875 §10 — ΤΑ ΣΩΜΑΤΑ ΠΟΥ ΣΤΕΛΝΕΙ Ο ΣΠΟΡΕΑΣ GOLDEN ΓΙΑ ΤΗΝ ΥΠΕΡΓΟΛΑΒΙΑ (ADR-928) — καθαρά, χωρίς I/O.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΖΟΥΝ ΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ ΣΠΟΡΕΑ (Pact-style contract anchor)
 *
 * Ρήτρα · πρότυπο · συμφωνητικό έχουν **έναν** γραφέα (`src/server/subcontracts/*`, CHECK 3.113) — άρα
 * σπέρνονται ΜΟΝΟ από το API της εικόνας, ποτέ με `db.set` (μάρτυρας θα ήταν δεύτερη αλήθεια). Το API όμως
 * τρέχει μόνο στο CI (emulators + `next build`). Για να μη μάθουμε ένα λάθος σώμα **μετά το merge**, τα
 * σώματα είναι εδώ, και η άγκυρα Γ10 (`i18n-ssr-golden.test.ts`) τα περνά από τους **ΙΔΙΟΥΣ** κριτές με
 * τον server: zod του route + `validateAgreementDraft` + `judgeClauseSelections` + κριτής του setup.
 *
 * 🔑 Το πρόχειρο βγαίνει από το `draftFromTemplate` — τον **ίδιο** δρόμο με το «Νέο» της οθόνης
 *    (`NewAgreementDialog`)· η βιβλιοθήκη = η προεπιλεγμένη, κάθε ρήτρα στην έκδοση {@link GOLDEN_CLAUSE_VERSION}
 *    (ίδια προβολή με το `SEEDED_LIBRARY` του `agreement-editor-model.test.ts`). Ο σπορέας **αρνείται** αν η
 *    εικόνα έχει άλλη έκδοση σε ισχύ — ποτέ σιωπηλή απόκλιση από το συμβόλαιο.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { DEFAULT_CLAUSE_LIBRARY } from '@/config/subcontracts/default-clause-library';
import { DEFAULT_TRADE_TEMPLATES } from '@/config/subcontracts/default-trade-templates';
import {
  generateDeterministicSubcontractClauseId,
  generateDeterministicSubcontractTradeTemplateId,
} from '@/services/enterprise-id.service';
import type { CompanySetupInput } from '@/subapps/accounting/types';
import { draftFromTemplate } from '@/subapps/procurement/subcontracts/agreements/draft-from-template';
import type { SubcontractAgreementDraftInput } from '@/subapps/procurement/subcontracts/agreements/agreement-draft';
import type { ApprovedLibrary } from '@/subapps/procurement/subcontracts/agreements/judge-deviations';
import type { SubcontractTradeTemplate } from '@/subapps/procurement/subcontracts/types/trade-template';

/** Η έκδοση σε ισχύ κάθε ρήτρας μετά τη σπορά: η πρώτη πρόταση, εγκεκριμένη. */
export const GOLDEN_CLAUSE_VERSION = 1;

/** Το πρότυπο που γεννά το συμφωνητικό — το πρώτο της προεπιλεγμένης βιβλιοθήκης. */
const GOLDEN_TEMPLATE = DEFAULT_TRADE_TEMPLATES[0];

/** Η ρήτρα της σελίδας «πρόταση νέας έκδοσης» — η πρώτη του προτύπου, άρα σίγουρα σπαρμένη και εγκεκριμένη. */
const GOLDEN_CLAUSE_KEY = GOLDEN_TEMPLATE.clauses[0].clauseKey;

/** Τα κλειδιά που σπέρνει το `POST /api/subcontracts/library/seed` — όσα θα εγκρίνει ο σπορέας. */
export const GOLDEN_CLAUSE_KEYS: readonly string[] = DEFAULT_CLAUSE_LIBRARY.map((clause) => clause.clauseKey);

export interface GoldenSubcontractIds {
  readonly subcontractClause: string;
  readonly subcontractTemplate: string;
}

/** Τα ids της βιβλιοθήκης — ντετερμινιστικά από τον ΙΔΙΟ γεννήτορα με τους γραφείς (SSoT `enterprise-id.service`). */
export function goldenSubcontractIds(companyId: string): GoldenSubcontractIds {
  return {
    subcontractClause: generateDeterministicSubcontractClauseId(companyId, GOLDEN_CLAUSE_KEY),
    subcontractTemplate: generateDeterministicSubcontractTradeTemplateId(companyId, GOLDEN_TEMPLATE.code),
  };
}

/** Η προεπιλεγμένη βιβλιοθήκη όπως τη βλέπει ο κριτής μετά τη σπορά και την έγκριση. */
export function goldenApprovedLibrary(companyId: string): ApprovedLibrary {
  return new Map(
    DEFAULT_CLAUSE_LIBRARY.map((clause) => [
      clause.clauseKey,
      { clauseId: generateDeterministicSubcontractClauseId(companyId, clause.clauseKey), version: GOLDEN_CLAUSE_VERSION, parameters: clause.parameters },
    ]),
  );
}

/** Το πρότυπο όπως το γράφει ο `newTradeTemplateRecord` — το περίβλημα δεν το διαβάζει το `draftFromTemplate`. */
function goldenTemplateRecord(companyId: string): SubcontractTradeTemplate {
  const stamp = '1970-01-01T00:00:00.000Z';
  return {
    ...GOLDEN_TEMPLATE,
    id: goldenSubcontractIds(companyId).subcontractTemplate,
    companyId,
    isArchived: false,
    revision: 1,
    createdAt: stamp,
    updatedAt: stamp,
    createdBy: 'golden',
    updatedBy: 'golden',
  };
}

export interface GoldenAgreementChoice {
  readonly companyId: string;
  readonly projectId: string;
  readonly subcontractorContactId: string;
}

/** Σώμα του `POST /api/subcontracts/agreements` — πρόχειρο `single_project` στο golden έργο. */
export function goldenAgreementBody(choice: GoldenAgreementChoice): { readonly draft: SubcontractAgreementDraftInput } {
  const { draft, unresolved } = draftFromTemplate(goldenTemplateRecord(choice.companyId), goldenApprovedLibrary(choice.companyId), {
    scope: { kind: 'single_project', projectId: choice.projectId, buildingIds: [] },
    subcontractorContactId: choice.subcontractorContactId,
  });
  if (unresolved.length > 0) throw new Error(`ADR-875 §10: το πρότυπο ${GOLDEN_TEMPLATE.code} έχει ρήτρες εκτός βιβλιοθήκης: ${unresolved.join(', ')}`);
  return { draft };
}

/** Σώμα του `POST …/clauses/[id]/versions/[version]/approve`. */
export function goldenApproveBody(expectedRevision: number): { expectedRevision: number; effectiveFrom: null; reason: null } {
  return { expectedRevision, effectiveFrom: null, reason: null };
}

/**
 * Σώμα του `PUT /api/accounting/setup` — ο **εκδότης** του συμφωνητικού (`readIssuer`, αλλιώς `issuerProfileMissing`).
 * ⚠️ Η επωνυμία = το `companies.name` του χώρου: άλλη τιμή θα πυροδοτούσε μετονομασία (`propagateCompanyRename`).
 */
export function goldenIssuerSetupBody(businessName: string): Partial<CompanySetupInput> {
  return {
    entityType: 'sole_proprietor',
    businessName,
    profession: 'Τεχνική εταιρεία (DEMO)',
    vatNumber: '099999999',
    taxOffice: 'Α΄ Αθηνών',
    address: 'Πανεπιστημίου 1',
    city: 'Αθήνα',
    postalCode: '10564',
    mainKad: { code: '41202000', description: 'Κατασκευή κτιρίων (DEMO)', type: 'primary', activeFrom: '2020-01-01' },
  };
}

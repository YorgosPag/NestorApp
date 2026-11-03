'use client';

/**
 * Το σώμα της σελίδας ενός συμφωνητικού (ADR-928 Φ3γ απόφαση 5): πρόχειρο + δικαίωμα ⇒ ο επεξεργαστής· αλλιώς το
 * έγγραφο για ανάγνωση. Και στις δύο, οι μεταβάσεις κύκλου ζωής και οι αποκλίσεις.
 *
 * 🔑 Η κατάσταση του πρόχειρου ζει **εδώ** (`useAgreementEditor`), ώστε μεταβάσεις και αποφάσεις αποκλίσεων να ξέρουν
 *    αν ο άνθρωπος έχει μη αποθηκευμένες αλλαγές.
 * 🔑 Δικαίωμα = ο ίδιος κανόνας πόρου με τον διακομιστή (`useSubcontractAuthority`) — κρύβει, δεν προστατεύει (ADR-801).
 * Φορτώνεται με `import()` από τη σελίδα (ADR-744 §34): μοντέλο εγγράφου, κριτής, bundles εγγράφου εκτός slice.
 */

import { useSubcontractAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { AgreementDocumentColumns, AgreementPaymentCalendar } from '../document/AgreementDocumentColumns';
import AgreementEditor from './AgreementEditor';
import { AgreementLifecycleActions } from './AgreementLifecycleActions';
import { DeviationsPanel } from './DeviationsPanel';
import { useAgreementEditor } from './useAgreementEditor';

export interface AgreementDetailBodyProps {
  readonly agreement: SubcontractAgreement;
  readonly projectId: string;
}

function EditableBody({ agreement, projectId, canApprove }: AgreementDetailBodyProps & { readonly canApprove: boolean }) {
  const editor = useAgreementEditor(agreement);
  return (
    <>
      <AgreementLifecycleActions agreement={agreement} projectId={projectId} unsaved={editor.unsaved} />
      <DeviationsPanel agreement={agreement} canApprove={canApprove} unsaved={editor.unsaved} />
      <AgreementEditor editor={editor} />
    </>
  );
}

function ReadOnlyBody({ agreement, projectId, canApprove }: AgreementDetailBodyProps & { readonly canApprove: boolean }) {
  return (
    <>
      <AgreementLifecycleActions agreement={agreement} projectId={projectId} unsaved={false} />
      <DeviationsPanel agreement={agreement} canApprove={canApprove} unsaved={false} />
      <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <AgreementDocumentColumns agreement={agreement} />
        <AgreementPaymentCalendar agreement={agreement} />
      </section>
    </>
  );
}

export default function AgreementDetailBody({ agreement, projectId }: AgreementDetailBodyProps) {
  const authority = useSubcontractAuthority(projectId);
  const editable = agreement.status === 'draft' && authority.canManage(agreement);
  return editable
    ? <EditableBody agreement={agreement} projectId={projectId} canApprove={authority.canApproveDeviation} />
    : <ReadOnlyBody agreement={agreement} projectId={projectId} canApprove={authority.canApproveDeviation} />;
}

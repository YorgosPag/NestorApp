'use client';

/**
 * Το σώμα της σελίδας ενός συμφωνητικού (ADR-928 Φ3γ απόφαση 5): πρόχειρο + δικαίωμα ⇒ ο επεξεργαστής· αλλιώς το
 * έγγραφο για ανάγνωση. Και στις δύο, οι μεταβάσεις κύκλου ζωής και οι αποκλίσεις.
 *
 * 🔑 Η κατάσταση του πρόχειρου ζει **εδώ** (`useAgreementEditor`), ώστε μεταβάσεις και αποφάσεις αποκλίσεων να ξέρουν
 *    αν ο άνθρωπος έχει μη αποθηκευμένες αλλαγές.
 * 🔑 §5.23 — **μία** γραμμή κεφαλίδας, όπως η γραμμή εγγράφου του Google Docs / Procore: τίτλος αριστερά, δεξιά η
 *    κατάσταση πρόχειρου + Αποθήκευση και οι μεταβάσεις (Έκδοση · Απόρριψη πρόχειρου), με διαχωριστικό ανάμεσα — δύο
 *    «Απόρριψη» δίπλα-δίπλα χωρίς όριο θα μπερδεύονταν. Ήταν τρεις γραμμές πάνω από τον επεξεργαστή.
 * 🔑 Δικαίωμα = ο ίδιος κανόνας πόρου με τον διακομιστή (`useSubcontractAuthority`) — κρύβει, δεν προστατεύει (ADR-801).
 * Φορτώνεται με `import()` από τη σελίδα (ADR-744 §34): μοντέλο εγγράφου, κριτής, bundles εγγράφου εκτός slice.
 */

import type { ReactNode } from 'react';
import { Separator } from '@/components/ui/separator';
import { useSubcontractAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import type { SubcontractAgreement } from '@/subapps/procurement/subcontracts/types/agreement';
import { AgreementDocumentColumns, AgreementPaymentCalendar } from '../document/AgreementDocumentColumns';
import AgreementEditor from './AgreementEditor';
import { AgreementLifecycleActions } from './AgreementLifecycleActions';
import { DeviationsPanel } from './DeviationsPanel';
import { EditorToolbar } from './EditorToolbar';
import { useAgreementEditor } from './useAgreementEditor';
import { WorkOrdersPanel } from '../work-orders/WorkOrdersPanel';

export interface AgreementDetailBodyProps {
  readonly agreement: SubcontractAgreement;
  /** Το έργο του πλαισίου· `null` στη σελίδα της εταιρείας (κύρια σύμβαση, ADR-928 §5.24). */
  readonly projectId: string | null;
  /** Ο τίτλος του εγγράφου (αριθμός · τίτλος · κατάσταση), από τη σελίδα — μπαίνει αριστερά στη γραμμή κεφαλίδας. */
  readonly title: ReactNode;
}

type BodyProps = AgreementDetailBodyProps & { readonly canApprove: boolean };

function HeaderRow({ title, children }: { readonly title: ReactNode; readonly children: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      {title}
      <section className="flex flex-wrap items-start gap-3">{children}</section>
    </header>
  );
}

function EditableBody({ agreement, projectId, title, canApprove }: BodyProps) {
  const editor = useAgreementEditor(agreement);
  return (
    <>
      <HeaderRow title={title}>
        <EditorToolbar editor={editor} />
        <Separator orientation="vertical" className="hidden h-9 sm:block" />
        <AgreementLifecycleActions agreement={agreement} projectId={projectId} unsaved={editor.unsaved} />
      </HeaderRow>
      <DeviationsPanel agreement={agreement} canApprove={canApprove} unsaved={editor.unsaved} />
      <WorkOrdersPanel agreement={agreement} />
      <AgreementEditor editor={editor} />
    </>
  );
}

function ReadOnlyBody({ agreement, projectId, title, canApprove }: BodyProps) {
  return (
    <>
      <HeaderRow title={title}>
        <AgreementLifecycleActions agreement={agreement} projectId={projectId} unsaved={false} />
      </HeaderRow>
      <DeviationsPanel agreement={agreement} canApprove={canApprove} unsaved={false} />
      <WorkOrdersPanel agreement={agreement} />
      <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
        <AgreementDocumentColumns agreement={agreement} />
        <AgreementPaymentCalendar agreement={agreement} />
      </section>
    </>
  );
}

export default function AgreementDetailBody(props: AgreementDetailBodyProps) {
  const authority = useSubcontractAuthority(props.projectId);
  const editable = props.agreement.status === 'draft' && authority.canManage(props.agreement);
  return editable
    ? <EditableBody {...props} canApprove={authority.canApproveDeviation} />
    : <ReadOnlyBody {...props} canApprove={authority.canApproveDeviation} />;
}

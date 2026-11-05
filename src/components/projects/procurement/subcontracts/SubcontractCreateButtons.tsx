'use client';

/**
 * Τα κουμπιά γέννησης της υπεργολαβίας (ADR-928 §5.15 · §5.24) — **ένα** σημείο για την καρτέλα έργου και τη σελίδα
 * κύριων συμβάσεων. Οι διάλογοι φτάνουν με `import()`: η λίστα δεν κουβαλά πρότυπα, κριτή ή σχήμα εντολής.
 * Fail-closed: κανένα κουμπί πριν την κρίση (`useSubcontractAuthority`). Κρύβει, δεν προστατεύει (ADR-801).
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ClipboardList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubcontractAuthority } from '@/hooks/procurement/subcontracts/useSubcontractAuthority';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const NewAgreementDialog = dynamic(() => import('@/components/procurement/subcontracts/editor/NewAgreementDialog'), { ssr: false });
const NewWorkOrderDialog = dynamic(() => import('@/components/procurement/subcontracts/work-orders/NewWorkOrderDialog'), { ssr: false });

interface Props {
  /** Το έργο του πλαισίου· `null` ⇒ η σελίδα της εταιρείας (μόνο κύρια σύμβαση). */
  readonly projectId: string | null;
}

/**
 * «Νέο» μόνο όταν ο θεατής μπορεί να γεννήσει κάτι — συμφωνητικό του έργου ή κύρια σύμβαση (§5.15). Στη σελίδα της
 * εταιρείας η λέξη είναι «Νέα κύρια σύμβαση»: εκεί δεν υπάρχει έργο για συμφωνητικό ενός έργου.
 */
export function NewAgreementButton({ projectId }: Props) {
  const { t } = useTranslation('procurement');
  const authority = useSubcontractAuthority(projectId);
  const [open, setOpen] = useState(false);
  if (!authority.canCreateForProject && !authority.canCreateMaster) return null;
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" aria-hidden />{t(projectId === null ? 'subcontracts.masters.new' : 'subcontracts.editor.new.action')}
      </Button>
      {open && <NewAgreementDialog projectId={projectId} canCreateForProject={authority.canCreateForProject} canCreateMaster={authority.canCreateMaster} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * «Νέα εντολή εργασίας» προς **αυτό** το έργο, κάτω από μια κύρια σύμβαση της εταιρείας (§5.24 · AIA A422): ο υπεύθυνος
 * του έργου βρίσκει εδώ τις συμβάσεις που δέχονται εντολή, χωρίς να ξέρει πού ζουν.
 */
export function NewWorkOrderButton({ projectId }: { readonly projectId: string }) {
  const { t } = useTranslation('procurement');
  const { canAssign } = useSubcontractAuthority(projectId);
  const [open, setOpen] = useState(false);
  if (!canAssign) return null;
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}><ClipboardList className="mr-2 h-4 w-4" aria-hidden />{t('subcontracts.workOrders.action')}</Button>
      {open && <NewWorkOrderDialog agreement={null} fixedProjectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}

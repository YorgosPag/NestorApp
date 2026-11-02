/**
 * Νέα εργασία από την καρτέλα lead.
 *
 * Λεπτό περίβλημα του `CalendarCreateDialog`, που είναι το SSoT δημιουργίας εργασίας:
 * εδώ ζει μόνο η μετάφραση των props της καρτέλας και το δέσιμο με το lead.
 *
 * @module components/crm/dashboard/dialogs/CreateTaskModal
 * @see ADR-251
 */

'use client';

import { CalendarCreateDialog, type TaskLeadLink } from '@/components/crm/calendar/CalendarCreateDialog';
import type { Opportunity } from '@/types/crm';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
  preselectedLead?: Opportunity | null;
}

function toLeadLink(lead: Opportunity | null | undefined): TaskLeadLink | undefined {
  if (!lead?.id) return undefined;
  return { id: lead.id, companyId: lead.companyId, contactId: lead.contactId };
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onTaskCreated,
  preselectedLead,
}: CreateTaskModalProps) {
  return (
    <CalendarCreateDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onCreated={onTaskCreated}
      lead={toLeadLink(preselectedLead)}
    />
  );
}

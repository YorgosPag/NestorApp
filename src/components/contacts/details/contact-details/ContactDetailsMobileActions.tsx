import React from 'react';
import { Check, Edit, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useActionMessages } from '@/hooks/useEnterpriseMessages';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';

interface ContactDetailsMobileActionsProps {
  isEditing: boolean;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}

export function ContactDetailsMobileActions({
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: ContactDetailsMobileActionsProps) {
  const actionMessages = useActionMessages();
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();

  return (
    <section className="md:hidden">
      {!isEditing ? (
        <div className="flex justify-end mb-4">
          <Button onClick={onStartEdit} className={layout.flexCenterGap2} variant="outline">
            <Edit className={iconSizes.sm} />
            {actionMessages.edit}
          </Button>
        </div>
      ) : (
        <div className={`${layout.flexGap2} justify-end mb-4`}>
          <Button onClick={onSaveEdit} className={layout.flexCenterGap2} variant="default">
            <Check className={iconSizes.sm} />
            {actionMessages.save}
          </Button>
          <Button onClick={onCancelEdit} className={layout.flexCenterGap2} variant="outline">
            <X className={iconSizes.sm} />
            {actionMessages.cancel}
          </Button>
        </div>
      )}
    </section>
  );
}

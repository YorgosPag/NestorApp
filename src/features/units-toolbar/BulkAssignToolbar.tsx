'use client';
import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, Check, X } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useNotifications } from '@/providers/NotificationProvider';
import { getContactDisplayName } from '@/types/contacts';
import { useBulkAssign } from './hooks/useBulkAssign';

export function BulkAssignToolbar({
  selectedIds,
  onClearSelection,
  onAssignmentSuccess,
}: {
  selectedIds: string[];
  onClearSelection: () => void;
  onAssignmentSuccess: () => void;
}) {
  const iconSizes = useIconSizes();
  const { getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const notifications = useNotifications();
  const {
    contacts,
    selectedContactId,
    setSelectedContactId,
    isLoading,
    assignToContact,
  } = useBulkAssign({ notifications, onSuccess: onAssignmentSuccess });

  const handleAssign = () => assignToContact(selectedIds);

  return (
    <div className={`p-2 ${getDirectionalBorder('info', 'top')} ${colors.bg.info}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <User className={`${iconSizes.sm} ${colors.text.info}`} />
            <Label className="text-sm font-medium ${colors.text.info}">
              Μαζική Ανάθεση σε Πελάτη
            </Label>
          </div>
          <Select value={selectedContactId} onValueChange={setSelectedContactId}>
            <SelectTrigger className="w-[250px] h-8 text-xs">
              <SelectValue placeholder="Επιλογή πελάτη..." />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id!}>
                  {getContactDisplayName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleAssign}
            disabled={isLoading || !selectedContactId}
          >
            <Check className={`${iconSizes.sm} mr-2`} />
            {isLoading ? 'Ανάθεση...' : 'Ανάθεση'}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={onClearSelection}
        >
          <X className={`${iconSizes.xs} mr-1`} />
          Καθαρισμός Επιλογής ({selectedIds.length})
        </Button>
      </div>
    </div>
  );
}

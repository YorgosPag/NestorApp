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
import { useToast } from '@/hooks/useToast';
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
  const { toast } = useToast();
  const {
    contacts,
    selectedContactId,
    setSelectedContactId,
    isLoading,
    assignToContact,
  } = useBulkAssign({ toast, onSuccess: onAssignmentSuccess });

  const handleAssign = () => assignToContact(selectedIds);

  return (
    <div className="p-2 border-t bg-blue-50 dark:bg-blue-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-700 dark:text-blue-300" />
            <Label className="text-sm font-medium text-blue-800 dark:text-blue-200">
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
            <Check className="w-4 h-4 mr-2" />
            {isLoading ? 'Ανάθεση...' : 'Ανάθεση'}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={onClearSelection}
        >
          <X className="w-3 h-3 mr-1" />
          Καθαρισμός Επιλογής ({selectedIds.length})
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useIconSizes } from '@/hooks/useIconSizes';
import { FileText, Plus } from 'lucide-react';

interface EmptyStateProps {
  readOnly: boolean;
  onAddSection: () => void;
}

export function EmptyState({ readOnly, onAddSection }: EmptyStateProps) {
  const iconSizes = useIconSizes();

  return (
    <Card>
      <CardContent className="text-center py-12">
        <FileText className={`${iconSizes.huge} mx-auto mb-4 text-muted-foreground/50`} />
        <h3 className="font-medium mb-2">Δεν υπάρχουν ενότητες</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Ξεκινήστε προσθέτοντας την πρώτη ενότητα της συγγραφής υποχρεώσεων
        </p>
        {!readOnly && (
          <Button onClick={onAddSection}>
            <Plus className={`${iconSizes.sm} mr-2`} />
            Προσθήκη Ενότητας
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

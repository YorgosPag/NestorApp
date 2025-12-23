
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function EmptyState() {
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Πελάτες Έργου</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <Users className={`${iconSizes.xl2} mx-auto mb-2`} />
          <p>Δεν υπάρχουν καταχωρημένοι πελάτες για αυτό το έργο.</p>
        </div>
      </CardContent>
    </Card>
  );
}

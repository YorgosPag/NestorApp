
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export function EmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Πελάτες Έργου</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-2" />
          <p>Δεν υπάρχουν καταχωρημένοι πελάτες για αυτό το έργο.</p>
        </div>
      </CardContent>
    </Card>
  );
}

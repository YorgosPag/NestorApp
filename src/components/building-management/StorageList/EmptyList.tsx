'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Archive } from 'lucide-react';

export function EmptyList() {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Archive className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Δεν βρέθηκαν μονάδες
        </h3>
        <p className="text-sm text-muted-foreground">
          Δεν υπάρχουν αποθήκες ή θέσεις στάθμευσης που να ταιριάζουν με τα κριτήρια αναζήτησης.
        </p>
      </CardContent>
    </Card>
  );
}

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle } from 'lucide-react';

export function LegalInfoCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Νομικά Στοιχεία
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Αριθμός Συμβολαίου</Label>
            <Input disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Ημερομηνία Συμβολαίου</Label>
            <Input type="date" disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Αρχείο Συμβολαίου</Label>
            <Input disabled className="bg-muted" />
          </div>
          <div className="space-y-2">
            <Label>Συμβολαιογράφος</Label>
            <Input disabled className="bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

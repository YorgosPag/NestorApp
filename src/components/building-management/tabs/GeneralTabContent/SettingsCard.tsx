'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function SettingsCard() {
  const iconSizes = useIconSizes();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className={iconSizes.md} />
          Ρυθμίσεις
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Checkbox id="show-on-web" />
          <Label htmlFor="show-on-web">Προβολή στο διαδίκτυο</Label>
        </div>
      </CardContent>
    </Card>
  );
}

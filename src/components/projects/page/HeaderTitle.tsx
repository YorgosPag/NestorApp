'use client';

import React from 'react';
import { Briefcase } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

export function HeaderTitle() {
  const iconSizes = useIconSizes();
  return (
    <div className="flex items-center gap-3">
      <div className={`flex ${iconSizes.xl2} items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg`}>
        <Briefcase className={`${iconSizes.md} text-white`} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Διαχείριση Έργων</h1>
        <p className="text-sm text-muted-foreground">
          Διαχείριση και παρακολούθηση κατασκευαστικών έργων
        </p>
      </div>
    </div>
  );
}

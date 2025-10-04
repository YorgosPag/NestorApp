'use client';

import React from 'react';
import { Briefcase } from 'lucide-react';

export function HeaderTitle() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
        <Briefcase className="h-5 w-5 text-white" />
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

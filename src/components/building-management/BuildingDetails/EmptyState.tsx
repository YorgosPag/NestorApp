'use client';

import React from 'react';
import { Building2 } from 'lucide-react';

export function EmptyState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-card border rounded-lg min-w-0 shadow-sm text-center p-8">
            <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground">Επιλέξτε ένα κτίριο</h2>
            <p className="text-muted-foreground">Επιλέξτε ένα κτίριο από τη λίστα για να δείτε τις λεπτομέρειές του.</p>
        </div>
    );
}

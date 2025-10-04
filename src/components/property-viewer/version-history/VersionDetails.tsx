'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { formatDate, formatSize } from './version-utils';

export function VersionDetails({
  version,
  onRestore
}: {
  version: any;
  onRestore: (id: string) => void;
}) {
  if (!version) {
    return (
      <div className="text-center text-muted-foreground pt-20">
        <p>Επιλέξτε μια έκδοση για να δείτε τις λεπτομέρειες.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h3 className="font-semibold text-lg">Λεπτομέρειες Έκδοσης</h3>
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">ID:</span>
          <span className="ml-2 font-mono text-xs">{version.id}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Δημιουργός:</span>
          <span className="ml-2">{version.author?.name}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Ημερομηνία:</span>
          <span className="ml-2">{formatDate(version.timestamp)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Μέγεθος:</span>
          <span className="ml-2">{formatSize(version.size)}</span>
        </div>
      </div>

      {version.diff && (
        <div className="bg-muted/50 p-3 rounded-lg border">
          <h4 className="font-medium mb-2 text-sm">Αλλαγές:</h4>
          <div className="text-sm space-y-1">
            <div className="text-green-600">+ {version.diff.added.length} προσθήκες</div>
            <div className="text-blue-600">~ {version.diff.modified.length} τροποποιήσεις</div>
            <div className="text-red-600">- {version.diff.removed.length} διαγραφές</div>
          </div>
        </div>
      )}

      {version.thumbnail && (
        <div>
          <h4 className="font-medium mb-2 text-sm">Προεπισκόπηση:</h4>
          <img src={version.thumbnail} alt="Version preview" className="w-full rounded border" />
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <Button onClick={() => onRestore(version.id)} className="flex-1">
          Επαναφορά
        </Button>
        <Button variant="outline" className="flex-1">
          Σύγκριση
        </Button>
      </div>
    </div>
  );
}
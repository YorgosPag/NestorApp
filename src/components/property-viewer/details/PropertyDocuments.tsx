'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';

interface PropertyDocumentsProps {
  documents: ExtendedPropertyDetails['documents'];
}

export function PropertyDocuments({ documents }: PropertyDocumentsProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium flex items-center gap-1">
        <FileText className="h-3 w-3" />
        Έγγραφα
      </h4>
      <div className="space-y-1">
        {documents?.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between text-xs">
            <span className="truncate">{doc.name}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import React from 'react';

export function EmptyState({ projectId }: { projectId: number }) {
  return (
    <div className="p-4 text-center">
      <div className="text-gray-500 mb-2">Δεν βρέθηκε η δομή του έργου.</div>
      <div className="text-sm text-gray-400">Project ID: {projectId}</div>
    </div>
  );
}

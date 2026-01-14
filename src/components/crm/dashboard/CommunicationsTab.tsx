'use client';

import React from 'react';
import UnifiedInbox from '../UnifiedInbox_OLD';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';


export function CommunicationsTab() {
  const colors = useSemanticColors();
  return (
    <div className={`${colors.bg.primary} rounded-lg shadow`}>
       <div className="p-6 border-b">
        <h2 className="text-lg font-semibold">Αρχείο Επικοινωνίας</h2>
      </div>
      <div className="p-6">
        <UnifiedInbox />
      </div>
    </div>
  );
}

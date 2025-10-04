'use client';

import React from 'react';
import UnifiedInbox from '../UnifiedInbox';


export function CommunicationsTab() {
  return (
    <div className="bg-white dark:bg-card rounded-lg shadow">
       <div className="p-6 border-b">
        <h2 className="text-lg font-semibold">Αρχείο Επικοινωνίας</h2>
      </div>
      <div className="p-6">
        <UnifiedInbox />
      </div>
    </div>
  );
}

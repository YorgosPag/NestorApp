import React from 'react';
import type { Building } from '@/types/building/contracts';

interface StorageTabProps {
  building: Building;
}

export function StorageTab({ building }: StorageTabProps) {
  return (
    <div className="p-4">
      <h3>Αποθήκες - {building.name}</h3>
      <p>Διαχείριση αποθηκών για το κτίριο.</p>
    </div>
  );
}

export default StorageTab;
'use client';

import React from 'react';
import { LabeledSelect } from './LabeledSelect';
import { LabeledInput } from './LabeledInput';
import { Home, MapPin, Activity, Building2, Search } from 'lucide-react';

interface PropertyPageFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterFloor: string;
  setFilterFloor: (floor: string) => void;
  filterBuilding: string;
  setFilterBuilding: (building: string) => void;
}

const typeOptions = [
  { value: 'all', label: 'Όλοι οι τύποι' },
  { value: 'apartment', label: 'Διαμέρισμα' },
  { value: 'studio', label: 'Στούντιο' },
  { value: 'maisonette', label: 'Μεζονέτα' },
  { value: 'shop', label: 'Κατάστημα' },
  { value: 'office', label: 'Γραφείο' },
  { value: 'storage', label: 'Αποθήκη' },
];

const statusOptions = [
  { value: 'all', label: 'Όλες οι καταστάσεις' },
  { value: 'available', label: 'Διαθέσιμο' },
  { value: 'sold', label: 'Πουλημένο' },
  { value: 'reserved', label: 'Κρατημένο' },
  { value: 'owner', label: 'Οικοπεδούχου' },
];

const floorOptions = [
  { value: 'all', label: 'Όλοι οι όροφοι' },
  { value: 'Υπόγειο', label: 'Υπόγειο' },
  { value: 'Ισόγειο', label: 'Ισόγειο' },
  { value: '1ος Όροφος', label: '1ος Όροφος' },
  { value: '2ος Όροφος', label: '2ος Όροφος' },
  { value: '3ος Όροφος', label: '3ος Όροφος' },
  { value: '4ος Όροφος', label: '4ος Όροφος' },
  { value: '5ος Όροφος', label: '5ος Όροφος' },
];

const buildingOptions = [
  { value: 'all', label: 'Όλα τα κτίρια' },
  { value: 'A', label: 'Κτίριο A' },
  { value: 'B', label: 'Κτίριο B' },
  { value: 'C', label: 'Κτίριο C' },
  { value: 'D', label: 'Κτίριο D' },
];

export function PropertyPageFilters({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  filterFloor,
  setFilterFloor,
  filterBuilding,
  setFilterBuilding
}: PropertyPageFiltersProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
      <LabeledInput
        id="search"
        icon={<Search className="w-4 h-4" />}
        label="Αναζήτηση"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Αναζήτηση κωδικού, αγοραστή..."
        className="lg:col-span-1"
      />
      <LabeledSelect
        id="type-filter"
        icon={<Home className="w-3 h-3" />}
        label="Τύπος"
        value={filterType}
        onValueChange={setFilterType}
        options={typeOptions}
      />
      <LabeledSelect
        id="status-filter"
        icon={<Activity className="w-3 h-3" />}
        label="Κατάσταση"
        value={filterStatus}
        onValueChange={setFilterStatus}
        options={statusOptions}
      />
      <LabeledSelect
        id="floor-filter"
        icon={<MapPin className="w-3 h-3" />}
        label="Όροφος"
        value={filterFloor}
        onValueChange={setFilterFloor}
        options={floorOptions}
      />
      <LabeledSelect
        id="building-filter"
        icon={<Building2 className="w-3 h-3" />}
        label="Κτίριο"
        value={filterBuilding}
        onValueChange={setFilterBuilding}
        options={buildingOptions}
      />
    </div>
  );
}

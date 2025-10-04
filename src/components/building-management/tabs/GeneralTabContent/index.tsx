'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from './Header';
import { BasicInfoCard } from './BasicInfoCard';
import { TechnicalSpecsCard } from './TechnicalSpecsCard';
import { ProgressCard } from './ProgressCard';
import { FilesCard } from './FilesCard';
import { LegalInfoCard } from './LegalInfoCard';
import { SettingsCard } from './SettingsCard';
import type { Building } from '../../BuildingsPageContent';
import { validateForm } from './utils';
import { BuildingStats } from '../BuildingStats';
import { BuildingUnitsTable } from './BuildingUnitsTable';

export function GeneralTabContent({ building }: { building: Building }) {
  const [isEditing, setIsEditing] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    name: building.name,
    description: building.description || '',
    totalArea: building.totalArea,
    builtArea: building.builtArea,
    floors: building.floors,
    units: building.units,
    totalValue: building.totalValue,
    startDate: building.startDate || '',
    completionDate: building.completionDate || '',
    address: building.address || '',
    city: building.city || ''
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!isEditing) return;

    const delayId = setTimeout(() => {
      setAutoSaving(true);
      const saveId = setTimeout(() => {
        setAutoSaving(false);
        setLastSaved(new Date());
        console.log('Auto-saved:', formData);
      }, 1000);
      
      // Cleanup for the inner timeout
      return () => clearTimeout(saveId);
    }, 2000);

    // Cleanup for the outer timeout
    return () => clearTimeout(delayId);
  }, [formData, isEditing]);


  const handleSave = () => {
    if (validateForm(formData, setErrors)) {
      setIsEditing(false);
      setLastSaved(new Date());
      console.log('Manual save:', formData);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => {
        const newState = { ...prev, [field]: value };
        if (field === 'totalArea' && value > 0 && prev.builtArea === 0) {
            return { ...newState, builtArea: Math.round(value * 0.8) };
        }
        return newState;
    });
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <Header
        building={building}
        isEditing={isEditing}
        autoSaving={autoSaving}
        lastSaved={lastSaved}
        setIsEditing={setIsEditing}
        handleSave={handleSave}
      />
      <BuildingStats buildingId={String(building.id)} />
      <BasicInfoCard
        formData={formData}
        updateField={updateField}
        isEditing={isEditing}
        errors={errors}
      />
      <TechnicalSpecsCard
        formData={formData}
        updateField={updateField}
        isEditing={isEditing}
        errors={errors}
      />
      <ProgressCard progress={building.progress} />
      <BuildingUnitsTable buildingId={building.id} />
      <FilesCard />
      <LegalInfoCard />
      <SettingsCard />
    </div>
  );
}

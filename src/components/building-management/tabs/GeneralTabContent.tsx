'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './GeneralTabContent/Header';
import { BasicInfoCard } from './GeneralTabContent/BasicInfoCard';
import { TechnicalSpecsCard } from './GeneralTabContent/TechnicalSpecsCard';
import { ProgressCard } from './GeneralTabContent/ProgressCard';
import { FilesCard } from './GeneralTabContent/FilesCard';
import { LegalInfoCard } from './GeneralTabContent/LegalInfoCard';
import { SettingsCard } from './GeneralTabContent/SettingsCard';
import { CompanySelectorCard } from './GeneralTabContent/CompanySelectorCard';
import { ProjectSelectorCard } from './GeneralTabContent/ProjectSelectorCard';
import { BuildingAddressesCard } from './GeneralTabContent/BuildingAddressesCard';
import type { Building } from '../BuildingsPageContent';
import { validateForm } from './GeneralTabContent/utils';
import { BuildingStats } from './BuildingStats';
import { BuildingUnitsTable } from './GeneralTabContent/BuildingUnitsTable';
// 🏢 ENTERPRISE: Firestore persistence for building updates
import { updateBuilding } from '../building-services';


export function GeneralTabContent({ building }: { building: Building }) {
  const [isEditing, setIsEditing] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    name: building.name,
    description: building.description || '',
    totalArea: building.totalArea,
    builtArea: building.builtArea ?? 0,
    floors: building.floors,
    units: building.units ?? 0,
    totalValue: building.totalValue ?? 0,
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

  /**
   * 🏢 ENTERPRISE: Handle building save using Firestore
   *
   * Pattern: SAP/Salesforce/Microsoft Dynamics
   * - Validates form data
   * - Saves to Firestore database
   * - Dispatches real-time update event
   */
  const handleSave = useCallback(async () => {
    if (!validateForm(formData, setErrors)) {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      console.log('🏗️ Saving building to Firestore...', formData);

      // 🏢 ENTERPRISE: Call Firestore update function
      const result = await updateBuilding(String(building.id), {
        name: formData.name,
        description: formData.description,
        totalArea: formData.totalArea,
        builtArea: formData.builtArea,
        floors: formData.floors,
        units: formData.units,
        totalValue: formData.totalValue,
        startDate: formData.startDate,
        completionDate: formData.completionDate,
        address: formData.address,
        city: formData.city,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save building');
      }

      console.log('✅ Building saved successfully to Firestore');
      setIsEditing(false);
      setLastSaved(new Date());

    } catch (error) {
      console.error('❌ Error saving building:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save building');
    } finally {
      setIsSaving(false);
    }
  }, [building.id, formData]);

  const updateField = (field: string, value: string | number) => {
    setFormData(prev => {
        const newState = { ...prev, [field]: value };
        // 🏢 ENTERPRISE: Safe numeric check for auto-calculation
        const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        if (field === 'totalArea' && numericValue > 0 && prev.builtArea === 0) {
            return { ...newState, builtArea: Math.round(numericValue * 0.8) };
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
        autoSaving={autoSaving || isSaving}
        lastSaved={lastSaved}
        setIsEditing={setIsEditing}
        handleSave={handleSave}
      />
      {/* 🏢 ENTERPRISE: Show save error if any */}
      {saveError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative dark:bg-red-900 dark:border-red-700 dark:text-red-300">
          <strong className="font-bold">Σφάλμα: </strong>
          <span>{saveError}</span>
        </div>
      )}
      <BuildingStats buildingId={String(building.id)} />
      <BasicInfoCard
        formData={formData}
        updateField={updateField}
        isEditing={isEditing}
        errors={errors}
      />
      {/* 🏢 ENTERPRISE: Company Selector για σύνδεση Κτιρίου→Εταιρείας */}
      <CompanySelectorCard
        buildingId={String(building.id)}
        currentCompanyId={building.companyId}
        isEditing={isEditing}
        onCompanyChanged={(newCompanyId, companyName) => {
          console.log(`✅ Building ${building.id} linked to company ${companyName} (${newCompanyId})`);
        }}
      />
      {/* 🏢 ENTERPRISE: Project Selector για σύνδεση Κτιρίου→Έργου */}
      <ProjectSelectorCard
        buildingId={String(building.id)}
        currentProjectId={building.projectId}
        isEditing={isEditing}
        onProjectChanged={(newProjectId) => {
          console.log(`✅ Building ${building.id} linked to project ${newProjectId}`);
        }}
      />
      {/* 🏢 ENTERPRISE: Multi-address management (ADR-167) */}
      <BuildingAddressesCard
        buildingId={String(building.id)}
        projectId={building.projectId}
        addresses={building.addresses}
        legacyAddress={building.address}
        legacyCity={building.city}
      />
      <TechnicalSpecsCard
        formData={formData}
        updateField={updateField}
        isEditing={isEditing}
        errors={errors}
      />
      <ProgressCard progress={building.progress} />
      <BuildingUnitsTable buildingId={String(building.id)} />
      <FilesCard />
      <LegalInfoCard />
      <SettingsCard />
    </div>
  );
}

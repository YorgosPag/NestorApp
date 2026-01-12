
'use client';

import { useMemo, useCallback } from 'react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { generateAutoCode, validateForm } from './storageFormUtils';

interface UseStorageFormHandlersProps {
    unit: StorageUnit | null;
    formData: Partial<StorageUnit>;
    formType: StorageType;
    setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
    onSave: (unit: StorageUnit) => void;
    updateField: (field: keyof StorageUnit, value: StorageUnit[keyof StorageUnit]) => void;
}

export function useStorageFormHandlers({
    unit,
    formData,
    formType,
    setErrors,
    onSave,
    updateField
}: UseStorageFormHandlersProps) {

    const handleGenerateAutoCode = useCallback(() => {
        const autoCode = generateAutoCode(formData.type!, formData.floor!);
        updateField('code', autoCode);
    }, [formData.type, formData.floor, updateField]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const { isValid, errors: newErrors } = validateForm(formData);
        setErrors(newErrors);

        if (isValid) {
            const unitToSave: StorageUnit = {
                id: unit?.id || `${formData.type}_${Date.now()}`,
                code: formData.code!,
                type: formData.type!,
                floor: formData.floor!,
                area: formData.area!,
                price: formData.price!,
                status: formData.status as StorageStatus,
                description: formData.description!,
                building: formData.building!,
                project: formData.project!,
                company: formData.company!,
                linkedProperty: formData.linkedProperty,
                coordinates: formData.coordinates!,
                features: formData.features!
            };
            onSave(unitToSave);
        }
    }, [formData, onSave, unit, setErrors]);

    const formTitle = useMemo(() => (
        unit
            ? (formType === 'storage' ? 'Επεξεργασία Αποθήκης' : 'Επεξεργασία Θέσης Στάθμευσης')
            : (formType === 'storage' ? 'Νέα Αποθήκη' : 'Νέα Θέση Στάθμευσης')
    ), [unit, formType]);

    return {
        formTitle,
        handleGenerateAutoCode,
        handleSubmit,
    };
}

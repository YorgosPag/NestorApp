
'use client';

import { useMemo, useCallback } from 'react';
import type { StorageUnit, StorageType, StorageStatus } from '@/types/storage';
import { generateAutoCode, validateForm } from './storageFormUtils';

// 🏢 ENTERPRISE: Type for translate function (from useTranslation hook)
type TranslateFunction = (key: string) => string;

interface UseStorageFormHandlersProps {
    unit: StorageUnit | null;
    formData: Partial<StorageUnit>;
    formType: StorageType;
    setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
    onSave: (unit: StorageUnit) => void;
    updateField: (field: keyof StorageUnit, value: StorageUnit[keyof StorageUnit]) => void;
    // 🏢 ENTERPRISE: Optional translate function for i18n support
    t?: TranslateFunction;
}

export function useStorageFormHandlers({
    unit,
    formData,
    formType,
    setErrors,
    onSave,
    updateField,
    t
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

    // 🏢 ENTERPRISE: i18n-enabled form title
    const formTitle = useMemo(() => {
        if (t) {
            const key = unit
                ? (formType === 'storage' ? 'storage.form.title.editStorage' : 'storage.form.title.editParking')
                : (formType === 'storage' ? 'storage.form.title.newStorage' : 'storage.form.title.newParking');
            return t(key);
        }
        // Fallback for backward compatibility
        return unit
            ? (formType === 'storage' ? 'Edit Storage' : 'Edit Parking Spot')
            : (formType === 'storage' ? 'New Storage' : 'New Parking Spot');
    }, [unit, formType, t]);

    return {
        formTitle,
        handleGenerateAutoCode,
        handleSubmit,
    };
}

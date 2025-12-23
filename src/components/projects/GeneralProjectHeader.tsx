'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { Button } from '@/components/ui/button';
import { Edit, Save, X, CheckCircle } from 'lucide-react';

interface GeneralProjectHeaderProps {
    isEditing: boolean;
    autoSaving: boolean;
    lastSaved: Date | null;
    setIsEditing: (isEditing: boolean) => void;
    handleSave: () => void;
}

export function GeneralProjectHeader({ isEditing, autoSaving, lastSaved, setIsEditing, handleSave }: GeneralProjectHeaderProps) {
    const iconSizes = useIconSizes();
    const handleCancel = () => {
        // Here you might want to reset form data to its initial state
        setIsEditing(false);
    };

    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <CommonBadge
                  status="company"
                  customLabel="ID: 3"
                  variant="secondary"
                  size="sm"
                  className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                />
                <CommonBadge
                  status="company"
                  customLabel="Οικιστικό"
                  variant="outline"
                  size="sm"
                />
                
                {isEditing && (
                <div className="flex items-center gap-2 text-xs">
                    {autoSaving ? (
                    <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        <span className="text-blue-600">Αποθήκευση...</span>
                    </>
                    ) : lastSaved ? (
                    <>
                        <CheckCircle className={`${iconSizes.xs} text-green-600`} />
                        <span className="text-green-600">
                        Αποθηκεύτηκε {lastSaved.toLocaleTimeString('el-GR')}
                        </span>
                    </>
                    ) : null}
                </div>
                )}
            </div>
      
            <div className="flex items-center gap-2">
                {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className={`${iconSizes.sm} mr-2`} />
                    Επεξεργασία
                </Button>
                ) : (
                <>
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                        <X className={`${iconSizes.sm} mr-2`} />
                        Ακύρωση
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                        <Save className={`${iconSizes.sm} mr-2`} />
                        Αποθήκευση
                    </Button>
                </>
                )}
            </div>
        </div>
    );
}

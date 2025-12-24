'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { useButtonPatterns } from '@/hooks/useButtonPatterns';
import { useIconSizes } from '@/hooks/useIconSizes';
import { formatDateTime } from '@/lib/intl-utils';
import { Edit, Save, X, CheckCircle } from 'lucide-react';

interface HeaderProps {
    building: { id: string; category: string };
    isEditing: boolean;
    autoSaving: boolean;
    lastSaved: Date | null;
    setIsEditing: (isEditing: boolean) => void;
    handleSave: () => void;
}

export function Header({ building, isEditing, autoSaving, lastSaved, setIsEditing, handleSave }: HeaderProps) {
  // 🏢 ENTERPRISE: Centralized systems
  const buttonPatterns = useButtonPatterns();
  const iconSizes = useIconSizes();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <CommonBadge
          status="company"
          customLabel={`ID: ${building.id}`}
          variant="secondary"
          size="sm"
          className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
        />
        <CommonBadge
          status="company"
          customLabel={
            building.category === 'residential' ? 'Κατοικίες' :
            building.category === 'commercial' ? 'Εμπορικό' :
            building.category === 'mixed' ? 'Μικτή Χρήση' :
            building.category === 'industrial' ? 'Βιομηχανικό' : ''
          }
          variant="outline"
          size="sm"
        />
        
        {isEditing && (
          <div className="flex items-center gap-2 text-xs">
            {autoSaving ? (
              <>
                <div className={`animate-spin rounded-full ${iconSizes.xs} border-b-2 border-blue-600`}></div>
                <span className="text-blue-600">Αποθήκευση...</span>
              </>
            ) : lastSaved ? (
              <>
                <CheckCircle className={`${iconSizes.xs} text-green-600`} />
                <span className="text-green-600">
                  Αποθηκεύτηκε {formatDateTime(lastSaved, { timeStyle: 'medium' }).split(' ')[1]}
                </span>
              </>
            ) : null}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        {!isEditing ? (
          <Button {...buttonPatterns.actions.edit} onClick={() => setIsEditing(true)}>
            <Edit className={`${iconSizes.sm} mr-2`} />
            Επεξεργασία
          </Button>
        ) : (
          <>
            <Button {...buttonPatterns.actions.cancel} onClick={() => setIsEditing(false)}>
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

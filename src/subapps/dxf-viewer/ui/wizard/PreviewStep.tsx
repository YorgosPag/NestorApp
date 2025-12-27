'use client';

import React from 'react';
import { FileText, Building2, Ruler, CheckCircle, Scissors, AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useLevels } from '../../systems/levels';

export function PreviewStep() {
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { levels, importWizard } = useLevels();
  
  const selectedLevel = importWizard.selectedLevelId 
    ? levels.find(l => l.id === importWizard.selectedLevelId)
    : null;

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 Bytes';
    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium ${colors.text.primary} mb-2">
          Έτοιμο για Εισαγωγή
        </h3>
        <p className={`text-sm ${colors.text.muted} mb-6`}>
          Ελέγξτε τις ρυθμίσεις εισαγωγής και κάντε κλικ στο Εισαγωγή για να προσθέσετε το DXF αρχείο στο έργο σας.
        </p>
      </div>

      {/* File Information */}
      <div className={`${colors.bg.secondary} rounded-lg p-4`}>
        <h4 className={`text-sm font-medium ${colors.text.info} mb-3 flex items-center`}>
          <FileText className={`${iconSizes.sm} mr-2`} />
          Πληροφορίες Αρχείου
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className={colors.text.muted}>Αρχείο:</span>
            <span className="${colors.text.primary} font-medium">{importWizard.file?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className={colors.text.muted}>Μέγεθος:</span>
            <span className="${colors.text.primary} font-medium">
              {importWizard.file ? formatFileSize(importWizard.file.size) : 'Άγνωστο'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.text.muted}>Τύπος:</span>
            <span className="${colors.text.primary} font-medium">AutoCAD DXF</span>
          </div>
        </div>
      </div>

      {/* Level Assignment */}
      <div className={`${colors.bg.secondary} rounded-lg p-4`}>
        <h4 className={`text-sm font-medium ${colors.text.success} mb-3 flex items-center`}>
          <Building2 className={`${iconSizes.sm} mr-2`} />
          Ανάθεση Επιπέδου
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className={colors.text.muted}>Επίπεδο Προορισμού:</span>
            <span className="${colors.text.primary} font-medium">
              {selectedLevel?.name || importWizard.newLevelName || 'Άγνωστο'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.text.muted}>Ενέργεια:</span>
            <span className="${colors.text.primary} font-medium">
              {selectedLevel ? 'Προσθήκη σε υπάρχον επίπεδο' : 'Δημιουργία νέου επιπέδου'}
            </span>
          </div>
        </div>
      </div>

      {/* Scale & Units */}
      <div className={`${colors.bg.secondary} rounded-lg p-4`}>
        <h4 className={`text-sm font-medium ${colors.text.accent} mb-3 flex items-center`}>
          <Ruler className={`${iconSizes.sm} mr-2`} />
          Κλίμακα & Μονάδες
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className={colors.text.muted}>Μονάδες:</span>
            <span className="${colors.text.primary} font-medium">
              {importWizard.calibration?.units || 'χιλιοστά'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className={colors.text.muted}>Κλίμακα:</span>
            <span className="${colors.text.primary} font-medium">Εγγενής (1:1)</span>
          </div>
          <div className="flex justify-between">
            <span className={colors.text.muted}>Βαθμονόμηση:</span>
            <span className="${colors.text.primary} font-medium">
              {importWizard.calibration ? 'Εφαρμοσμένη' : 'Καμία'}
            </span>
          </div>
        </div>
      </div>

      {/* DXF Processing Info */}
      <div className={`${colors.bg.warning} bg-opacity-30 ${getStatusBorder('warning')} rounded-lg p-4`}>
        <h4 className={`text-sm font-medium ${colors.text.warning} mb-3 flex items-center`}>
          <Scissors className={`${iconSizes.sm} mr-2`} />
          Επεξεργασία DXF
        </h4>
        <div className={`space-y-2 text-sm ${colors.text.warning}`}>
          <div className="flex items-start">
            <CheckCircle className={`${iconSizes.sm} mr-2 ${colors.text.success} mt-0.5`} />
            <span>Θα γίνει αυτόματη περικοπή κενής περιοχής γύρω από την κάτοψη</span>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className={`${colors.bg.info} bg-opacity-30 ${getStatusBorder('info')} rounded-lg p-4`}>
        <h4 className={`text-sm font-medium ${colors.text.info} mb-3`}>Τι συμβαίνει στη συνέχεια;</h4>
        <div className={`space-y-2 text-sm ${colors.text.info}`}>
          <div className="flex items-center">
            <CheckCircle className={`${iconSizes.sm} mr-2 ${colors.text.success}`} />
            <span>Το DXF αρχείο θα αναλυθεί και θα εισαχθεί</span>
          </div>
        </div>
      </div>

      {/* Warning if creating new level */}
      {importWizard.newLevelName && (
        <div className={`${colors.bg.warning} bg-opacity-30 ${getStatusBorder('warning')} rounded-lg p-3`}>
          <div className="flex items-center">
            <AlertTriangle className={`${iconSizes.sm} mr-2 ${colors.text.warning}`} />
            <p className={`text-sm ${colors.text.warning}`}>
              <strong>Θα δημιουργηθεί νέο επίπεδο:</strong> "{importWizard.newLevelName}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

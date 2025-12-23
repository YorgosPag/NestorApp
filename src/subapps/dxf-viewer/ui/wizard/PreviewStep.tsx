'use client';

import React from 'react';
import { FileText, Building2, Ruler, CheckCircle, Scissors, AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLevels } from '../../systems/levels';

export function PreviewStep() {
  const iconSizes = useIconSizes();
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
        <h3 className="text-lg font-medium text-white mb-2">
          Έτοιμο για Εισαγωγή
        </h3>
        <p className="text-sm text-gray-400 mb-6">
          Ελέγξτε τις ρυθμίσεις εισαγωγής και κάντε κλικ στο Εισαγωγή για να προσθέσετε το DXF αρχείο στο έργο σας.
        </p>
      </div>

      {/* File Information */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center">
          <FileText className={`${iconSizes.sm} mr-2`} />
          Πληροφορίες Αρχείου
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Αρχείο:</span>
            <span className="text-white font-medium">{importWizard.file?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Μέγεθος:</span>
            <span className="text-white font-medium">
              {importWizard.file ? formatFileSize(importWizard.file.size) : 'Άγνωστο'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Τύπος:</span>
            <span className="text-white font-medium">AutoCAD DXF</span>
          </div>
        </div>
      </div>

      {/* Level Assignment */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-green-400 mb-3 flex items-center">
          <Building2 className={`${iconSizes.sm} mr-2`} />
          Ανάθεση Επιπέδου
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Επίπεδο Προορισμού:</span>
            <span className="text-white font-medium">
              {selectedLevel?.name || importWizard.newLevelName || 'Άγνωστο'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Ενέργεια:</span>
            <span className="text-white font-medium">
              {selectedLevel ? 'Προσθήκη σε υπάρχον επίπεδο' : 'Δημιουργία νέου επιπέδου'}
            </span>
          </div>
        </div>
      </div>

      {/* Scale & Units */}
      <div className="bg-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-purple-400 mb-3 flex items-center">
          <Ruler className={`${iconSizes.sm} mr-2`} />
          Κλίμακα & Μονάδες
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Μονάδες:</span>
            <span className="text-white font-medium">
              {importWizard.calibration?.units || 'χιλιοστά'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Κλίμακα:</span>
            <span className="text-white font-medium">Εγγενής (1:1)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Βαθμονόμηση:</span>
            <span className="text-white font-medium">
              {importWizard.calibration ? 'Εφαρμοσμένη' : 'Καμία'}
            </span>
          </div>
        </div>
      </div>

      {/* DXF Processing Info */}
      <div className="bg-orange-900 bg-opacity-30 border border-orange-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-orange-400 mb-3 flex items-center">
          <Scissors className={`${iconSizes.sm} mr-2`} />
          Επεξεργασία DXF
        </h4>
        <div className="space-y-2 text-sm text-orange-200">
          <div className="flex items-start">
            <CheckCircle className={`${iconSizes.sm} mr-2 text-green-400 mt-0.5`} />
            <span>Θα γίνει αυτόματη περικοπή κενής περιοχής γύρω από την κάτοψη</span>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-400 mb-3">Τι συμβαίνει στη συνέχεια;</h4>
        <div className="space-y-2 text-sm text-blue-200">
          <div className="flex items-center">
            <CheckCircle className={`${iconSizes.sm} mr-2 text-green-400`} />
            <span>Το DXF αρχείο θα αναλυθεί και θα εισαχθεί</span>
          </div>
        </div>
      </div>

      {/* Warning if creating new level */}
      {importWizard.newLevelName && (
        <div className="bg-yellow-900 bg-opacity-30 border border-yellow-700 rounded-lg p-3">
          <div className="flex items-center">
            <AlertTriangle className={`${iconSizes.sm} mr-2 text-yellow-400`} />
            <p className="text-sm text-yellow-200">
              <strong>Θα δημιουργηθεί νέο επίπεδο:</strong> "{importWizard.newLevelName}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

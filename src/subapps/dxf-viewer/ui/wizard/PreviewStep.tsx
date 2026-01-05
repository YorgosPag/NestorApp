'use client';

import React from 'react';
import { FileText, Building2, Ruler, CheckCircle, Scissors, AlertTriangle } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useLevels } from '../../systems/levels';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

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
    <section className={PANEL_LAYOUT.SPACING.GAP_XL}>
      {/* ✅ ENTERPRISE: Semantic header + fix broken template string (ADR-003) */}
      <header>
        <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
          Έτοιμο για Εισαγωγή
        </h3>
        <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
          Ελέγξτε τις ρυθμίσεις εισαγωγής και κάντε κλικ στο Εισαγωγή για να προσθέσετε το DXF αρχείο στο έργο σας.
        </p>
      </header>

      {/* File Information */}
      <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.info} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center`}>
          <FileText className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
          Πληροφορίες Αρχείου
        </h4>
        <dl className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>Αρχείο:</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{importWizard.file?.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>Μέγεθος:</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {importWizard.file ? formatFileSize(importWizard.file.size) : 'Άγνωστο'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>Τύπος:</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>AutoCAD DXF</dd>
          </div>
        </dl>
      </article>

      {/* Level Assignment */}
      <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center`}>
          <Building2 className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
          Ανάθεση Επιπέδου
        </h4>
        <dl className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>Επίπεδο Προορισμού:</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {selectedLevel?.name || importWizard.newLevelName || 'Άγνωστο'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>Ενέργεια:</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {selectedLevel ? 'Προσθήκη σε υπάρχον επίπεδο' : 'Δημιουργία νέου επιπέδου'}
            </dd>
          </div>
        </dl>
      </article>

      {/* Scale & Units */}
      <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.accent} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center`}>
          <Ruler className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
          Κλίμακα & Μονάδες
        </h4>
        <dl className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>Μονάδες:</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {importWizard.calibration?.units || 'χιλιοστά'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>Κλίμακα:</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>Εγγενής (1:1)</dd>
          </div>
          <div className="flex justify-between">
            <dt className={colors.text.muted}>Βαθμονόμηση:</dt>
            <dd className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>
              {importWizard.calibration ? 'Εφαρμοσμένη' : 'Καμία'}
            </dd>
          </div>
        </dl>
      </article>

      {/* DXF Processing Info */}
      <aside className={`${colors.bg.warning} ${PANEL_LAYOUT.BG_OPACITY['30']} ${getStatusBorder('warning')} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.warning} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD} flex items-center`}>
          <Scissors className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM}`} />
          Επεξεργασία DXF
        </h4>
        <ul className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.warning}`}>
          <li className="flex items-start">
            <CheckCircle className={`${iconSizes.sm} ${PANEL_LAYOUT.SPACING.GAP_H_SM} ${colors.text.success} ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} />
            <span>Θα γίνει αυτόματη περικοπή κενής περιοχής γύρω από την κάτοψη</span>
          </li>
        </ul>
      </aside>

      {/* What Happens Next */}
      <aside className={`${colors.bg.info} ${PANEL_LAYOUT.BG_OPACITY['30']} ${getStatusBorder('info')} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.LG}`}>
        <h4 className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.info} ${PANEL_LAYOUT.MARGIN.BOTTOM_MD}`}>Τι συμβαίνει στη συνέχεια;</h4>
        <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.info}`}>
          <div className="flex items-center">
            <CheckCircle className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} ${colors.text.success}`} />
            <span>Το DXF αρχείο θα αναλυθεί και θα εισαχθεί</span>
          </div>
        </div>
      </aside>

      {/* Warning if creating new level */}
      {importWizard.newLevelName && (
        <aside className={`${colors.bg.warning} ${PANEL_LAYOUT.BG_OPACITY['30']} ${getStatusBorder('warning')} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} ${PANEL_LAYOUT.SPACING.MD}`}>
          <div className="flex items-center">
            <AlertTriangle className={`${iconSizes.sm} ${PANEL_LAYOUT.MARGIN.RIGHT_SM} ${colors.text.warning}`} />
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.warning}`}>
              <strong>Θα δημιουργηθεί νέο επίπεδο:</strong> "{importWizard.newLevelName}"
            </p>
          </div>
        </aside>
      )}
    </section>
  );
}

'use client';
/**
 * 🏢 SSoT — Ο ΚΟΙΝΟΣ ΣΚΕΛΕΤΟΣ ΤΩΝ ΒΗΜΑΤΩΝ ΤΟΥ ΟΔΗΓΟΥ (CHECK 3.28 / N.18)
 *
 * Τα `WizardSteps.tsx` και `WizardStepsUnit.tsx` ήταν **δίδυμα**: ίδιοι τύποι,
 * ίδιο `useModalBorder`, ίδιο τρίπτυχο hooks σε κάθε βήμα, και **τέσσερις**
 * πανομοιότυπες κάρτες «φόρτωσε κάτοψη». Το jscpd (--diff) τα ονόμασε με
 * ονόματα και γραμμές· εδώ ζουν **μία φορά**.
 *
 * ⚠️ ΜΗΝ αντιγράψεις τίποτα από εδώ πίσω στα βήματα: ο κανόνας N.18 απαγορεύει
 * sibling clones, και το CHECK 3.28 τα ξαναπιάνει στο επόμενο commit.
 *
 * ⚠️ ΤΟ `useTranslation` ΜΕ ΚΥΡΙΟΛΕΚΤΙΚΟ ΠΙΝΑΚΑ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ, ΟΧΙ ΓΟΥΣΤΟ:
 * ο γεννήτορας του shell slice (ADR-744) διαβάζει **κυριολεκτικούς** πίνακες.
 * Σταθερά στη θέση του πίνακα ⇒ ανεπίλυτο namespace ⇒ ωμό κλειδί στην οθόνη
 * (ADR-744 §18). Τα δύο αρχεία-καταναλωτές **κληρονομούν** αυτά τα namespaces
 * επειδή εισάγουν το `useWizardStepChrome`.
 */
import React from 'react';
import { Building as BuildingIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getModalIconColor } from '../../config/modal-colors';
import {
  MODAL_FLEX_PATTERNS, MODAL_DIMENSIONS, MODAL_SPACING, getIconSize,
} from '../../config/modal-layout';
import { ProjectModalContainer, ModalActions } from './ModalContainer';

// ── Κοινοί τύποι ───────────────────────────────────────────────
export interface CompanyData {
  id?: string;
  companyName: string;
  industry?: string;
}

export interface ProjectData {
  id: string;
  name: string;
}

export type ModalBorderVariant = 'default' | 'info' | 'success' | 'warning' | 'error';

/** Οι έξι κατόψεις που ξέρει να φορτώνει ο οδηγός. */
export type FloorplanTarget =
  | 'project' | 'parking' | 'building' | 'storage' | 'property' | 'floor';

export type LoadFloorplan = (type: FloorplanTarget) => void;

// ── Το τρίπτυχο κάθε βήματος ───────────────────────────────────
/**
 * Κάθε βήμα του οδηγού ζητούσε τα ίδια τρία πράγματα με τις ίδιες τρεις
 * γραμμές. Ένα σημείο, ένας πίνακας namespaces.
 */
export function useWizardStepChrome() {
  const { t } = useTranslation([
    'dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard',
    'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell',
  ]);
  const typography = useTypography();
  const { getStatusBorder } = useBorderTokens();
  const getBorder = React.useCallback(
    (variant: ModalBorderVariant) => getStatusBorder(variant),
    [getStatusBorder],
  );
  return { t, typography, getBorder };
}

// ── Ενότητα βήματος (τίτλος + περιεχόμενο) ─────────────────────
interface WizardStepSectionProps {
  /** Κλειδί i18n — ΠΟΤΕ ωμό κείμενο (N.11). */
  labelKey: string;
  children: React.ReactNode;
}

export function WizardStepSection({ labelKey, children }: WizardStepSectionProps) {
  const { t, typography } = useWizardStepChrome();
  return (
    <div className={MODAL_SPACING.SECTIONS.betweenSections}>
      <label className={`block ${typography.label.sm} ${MODAL_SPACING.SECTIONS.betweenItems}`}>
        {t(labelKey)}
      </label>
      {children}
    </div>
  );
}

// ── Κάρτα σύνοψης εταιρείας ────────────────────────────────────
interface CompanySummaryCardProps {
  company: CompanyData;
  /** Επιπλέον κλάσεις απόστασης του καλούντος (π.χ. `betweenItems`). */
  className?: string;
}

export function CompanySummaryCard({ company, className = '' }: CompanySummaryCardProps) {
  const { typography, getBorder } = useWizardStepChrome();
  return (
    <ProjectModalContainer title="" className={`${className} ${getBorder('info')}`.trim()}>
      <div className={MODAL_FLEX_PATTERNS.ROW.centerWithGap}>
        <BuildingIcon className={`${getIconSize('title')} ${getModalIconColor('info')}`} />
        <div>
          <p className={typography.heading.md}>{company.companyName}</p>
          <p className={typography.body.sm}>{company.industry}</p>
        </div>
      </div>
    </ProjectModalContainer>
  );
}

// ── Σημείωμα «δεν βρέθηκε τίποτα» ──────────────────────────────
interface WizardEmptyNoteProps {
  /** Κλειδί i18n — ΠΟΤΕ ωμό κείμενο (N.11). */
  messageKey: string;
}

export function WizardEmptyNote({ messageKey }: WizardEmptyNoteProps) {
  const { t, typography, getBorder } = useWizardStepChrome();
  return (
    <ProjectModalContainer title="" className={getBorder('default')}>
      <p className={typography.body.sm}>{t(messageKey)}</p>
    </ProjectModalContainer>
  );
}

// ── Υπόμνημα κάτω από ενέργεια ─────────────────────────────────
export function WizardHint({ messageKey }: WizardEmptyNoteProps) {
  const { t, typography } = useWizardStepChrome();
  return (
    <p className={`${typography.body.sm} ${MODAL_FLEX_PATTERNS.COLUMN.center} ${MODAL_SPACING.CONTAINER.paddingSmall}`}>
      {t(messageKey)}
    </p>
  );
}

// ── Κουμπί φόρτωσης κάτοψης ────────────────────────────────────
interface WizardLoadButtonProps {
  target: FloorplanTarget;
  /** Κλειδί i18n — ΠΟΤΕ ωμό κείμενο (N.11). */
  labelKey: string;
  onLoadFloorplan: LoadFloorplan;
}

export function WizardLoadButton({ target, labelKey, onLoadFloorplan }: WizardLoadButtonProps) {
  const { t } = useWizardStepChrome();
  return (
    <ModalActions alignment="center">
      <Button
        onClick={() => onLoadFloorplan(target)}
        variant="default" size="default"
        className={MODAL_DIMENSIONS.BUTTONS.flex}
      >
        {t(labelKey)}
      </Button>
    </ModalActions>
  );
}

// ── Πλήρης κάρτα «διάλεξε και φόρτωσε» ─────────────────────────
interface WizardFloorplanActionProps extends WizardLoadButtonProps {
  titleKey: string;
  hintKey: string;
  variant?: ModalBorderVariant;
}

export function WizardFloorplanAction({
  titleKey, labelKey, hintKey, target, onLoadFloorplan, variant = 'default',
}: WizardFloorplanActionProps) {
  const { t, getBorder } = useWizardStepChrome();
  return (
    <ProjectModalContainer
      title={t(titleKey)}
      className={`${MODAL_SPACING.SECTIONS.betweenBlocks} ${getBorder(variant)}`}
    >
      <WizardLoadButton target={target} labelKey={labelKey} onLoadFloorplan={onLoadFloorplan} />
      <WizardHint messageKey={hintKey} />
    </ProjectModalContainer>
  );
}

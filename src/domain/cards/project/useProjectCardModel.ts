'use client';

/**
 * 📋 PROJECT CARD VIEW-MODEL HOOK (ADR-585)
 *
 * Computes the shared, view-agnostic props consumed by BOTH ProjectGridCard
 * and ProjectListCard: stats, badges, title, aria. Subtitle is intentionally
 * NOT part of the model — it is derived differently per view (Grid = location,
 * List = company-first), so each wrapper computes its own.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';

import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import type { StatItem } from '@/design-system';
import type { GridCardBadgeVariant } from '@/design-system/components/GridCard/GridCard.types';
import { formatCurrency, formatNumber } from '@/lib/intl-utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Project } from '@/types/project';
// ADR-812: λεξιλόγιο ΚΑΙ ετικέτες από το leaf SSoT — το `@/types/project`
// τις επανεξάγει, αλλά σέρνει μαζί του ολόκληρο το dxf-viewer subapp.
import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@/constants/project-statuses';
import { splitNamespacedLabelKey } from '@/core/badges/badge-label-key';
import { ENTITY_TYPES } from '@/config/domain-constants';
import '@/lib/design-system';

import type { CardViewModel } from '../shared/card-model.types';

// =============================================================================
// 🏢 STATUS TO BADGE VARIANT MAPPING (Centralized)
// =============================================================================

/**
 * ADR-812 — `Record<ProjectStatus, …>`, ΟΧΙ `Record<string, …>`.
 *
 * Ο χαλαρός τύπος έκανε τον πίνακα να δέχεται ό,τι όνομα να 'ναι και να μη
 * ζητά ΚΑΜΙΑ κατάσταση: του έλειπε το `deleted` και τίποτα δεν το είπε — το
 * `?? 'default'` παρακάτω το έβαφε ουδέτερο γκρι, δηλαδή έργο στον κάδο έμοιαζε
 * με έργο χωρίς κατάσταση. Με τον σφιχτό τύπο, μια έβδομη κατάσταση στο SSoT
 * σπάει εδώ τη μεταγλώττιση αντί να ξεθωριάσει στην οθόνη.
 *
 * ⚠️ ΤΟ FALLBACK ΜΕΝΕΙ, και δεν είναι πλεονασμός: το `status` έρχεται από το
 * Firestore, όπου μπορεί να υπάρχει παλιά τιμή εκτός λεξιλογίου (μετρημένο —
 * το `ProjectDetailsHeader` κρατά repair path για `'active'`).
 */
const STATUS_BADGE_VARIANTS: Record<ProjectStatus, GridCardBadgeVariant> = {
  planning: 'warning',
  in_progress: 'info',
  completed: 'success',
  on_hold: 'secondary',
  cancelled: 'destructive',
  deleted: 'outline',
};

/**
 * Build the shared Project card view-model (title, badges, stats, aria).
 * Subtitle is omitted — each Grid/List wrapper derives it per view.
 */
export function useProjectCardModel(project: Project): CardViewModel {
  const { t } = useTranslation(['projects', 'projects-data', 'projects-ika']);

  /** Build stats array from project data */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Progress - 🏢 ENTERPRISE: i18n label
    if (project.progress !== undefined) {
      items.push({
        icon: TrendingUp,
        label: t('listCard.progress'),
        value: `${project.progress}%`,
        valueColor: project.progress >= 80 ? 'text-[hsl(var(--text-success))]' : undefined,
      });
    }

    // Total Area - 🏢 ENTERPRISE: Using centralized area icon/color + i18n label
    if (project.totalArea) {
      items.push({
        icon: NAVIGATION_ENTITIES.area.icon,
        iconColor: NAVIGATION_ENTITIES.area.color,
        label: t('listCard.totalArea'),
        value: `${formatNumber(project.totalArea)} m²`,
      });
    }

    // Total Value - 🏢 ENTERPRISE: Using centralized price icon/color + i18n label
    if (project.totalValue && project.totalValue > 0) {
      items.push({
        icon: NAVIGATION_ENTITIES.price.icon,
        iconColor: NAVIGATION_ENTITIES.price.color,
        label: t('listCard.value'),
        value: formatCurrency(project.totalValue, 'EUR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
        valueColor: NAVIGATION_ENTITIES.price.color,
      });
    }

    return items;
  }, [project.progress, project.totalArea, project.totalValue, t]);

  /**
   * Build badges from status.
   *
   * 🔴 **ΜΕΤΑΦΡΑΖΕΤΑΙ** (ADR-806 §7 #2, N.11). Ο `PROJECT_STATUS_LABELS` κρατούσε ωμό
   * **ελληνικό κείμενο** και το `label` πήγαινε κατευθείαν στο badge: η κάρτα έγραφε
   * «Σχεδιασμός» **και σε αγγλόφωνο χρήστη**, ενώ αυτό το ίδιο hook καλεί `t(…)` σε
   * **κάθε άλλο** πεδίο του (`listCard.progress`, `listCard.totalArea`, …) τρεις
   * γραμμές πιο πάνω. Πλέον ο πίνακας κρατά **κλειδιά** και η μετάφραση γίνεται εδώ.
   *
   * ⚠️ Το `t` **μπαίνει στις εξαρτήσεις**: χωρίς αυτό η ετικέτα θα έμενε παγωμένη στη
   * γλώσσα που ίσχυε την πρώτη απόδοση — αλλαγή γλώσσας χωρίς αλλαγή `project.status`
   * δεν θα ξανάβαφε το badge. Το ίδιο κάνει ήδη το `useMemo` από πάνω.
   */
  const badges = useMemo(() => {
    const status = project.status || 'planning';
    const statusKey = PROJECT_STATUS_LABELS[status];
    const variant = STATUS_BADGE_VARIANTS[status as ProjectStatus] ?? 'default';
    const ref = splitNamespacedLabelKey(statusKey);

    return [{
      label: ref ? t(ref.key, { ns: ref.ns, defaultValue: statusKey }) : (statusKey || status),
      variant,
    }];
  }, [project.status, t]);

  const title = project.name || project.title || project.id;

  return {
    entityType: ENTITY_TYPES.PROJECT,
    title,
    badges,
    stats,
    ariaLabel: t('listCard.ariaLabel', { name: title }),
  };
}

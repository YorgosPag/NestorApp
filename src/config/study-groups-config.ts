/**
 * Study Groups Configuration — ADR-191
 *
 * Metadata for the 7 study categories required for building permits
 * per Greek legislation (ν. 4495/2017, ΝΟΚ).
 *
 * Each group maps to a set of UploadEntryPoints with matching `group` field.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type StudyGroup =
  | 'administrative'
  | 'fiscal'
  | 'architectural'
  | 'structural'
  | 'mechanical'
  | 'energy'
  | 'site';

export type EntityLevel = 'project' | 'building';

export interface StudyGroupMeta {
  readonly group: StudyGroup;
  readonly entityLevels: readonly EntityLevel[];
  readonly label: { readonly el: string; readonly en: string };
  readonly description: { readonly el: string; readonly en: string };
  readonly icon: string;
  readonly colorClass: string;
  readonly borderClass: string;
  readonly bgClass: string;
  readonly iconBgClass: string;
  readonly order: number;
}

// ─── Configuration ───────────────────────────────────────────────────────────

export const STUDY_GROUPS: readonly StudyGroupMeta[] = [
  {
    group: 'administrative',
    entityLevels: ['project'],
    label: { el: 'Διοικητικά / Νομικά', en: 'Administrative / Legal' },
    description: {
      el: 'Αίτηση, τίτλοι ιδιοκτησίας, κτηματογράφηση, εγκρίσεις',
      en: 'Application, property titles, cadastre, approvals',
    },
    icon: 'Briefcase',
    colorClass: 'text-blue-600',
    borderClass: 'border-l-blue-500',
    bgClass: 'bg-blue-50',
    iconBgClass: 'bg-blue-100',
    order: 1,
  },
  {
    group: 'fiscal',
    entityLevels: ['project'],
    label: { el: 'Φορολογικά / Ασφαλιστικά', en: 'Fiscal / Insurance' },
    description: {
      el: 'Εισφορές ΕΦΚΑ, αμοιβές μηχανικών, ΦΕΜ, κρατήσεις',
      en: 'EFKA contributions, engineer fees, taxes, deductions',
    },
    icon: 'Landmark',
    colorClass: 'text-emerald-600',
    borderClass: 'border-l-emerald-500',
    bgClass: 'bg-emerald-50',
    iconBgClass: 'bg-emerald-100',
    order: 2,
  },
  {
    group: 'architectural',
    entityLevels: ['building', 'project'],
    label: { el: 'Αρχιτεκτονικά / Πολεοδομικά', en: 'Architectural / Urban Planning' },
    description: {
      el: 'Κατόψεις, τομές, όψεις, τοπογραφικό, κάλυψη, δόμηση',
      en: 'Floor plans, sections, elevations, topographic, coverage',
    },
    icon: 'Ruler',
    colorClass: 'text-violet-600',
    borderClass: 'border-l-violet-500',
    bgClass: 'bg-violet-50',
    iconBgClass: 'bg-violet-100',
    order: 3,
  },
  {
    group: 'structural',
    entityLevels: ['building'],
    label: { el: 'Στατικά', en: 'Structural' },
    description: {
      el: 'Στατική μελέτη, σχέδια ξυλοτύπων, φέρουσα κατασκευή',
      en: 'Structural analysis, formwork plans, load-bearing structure',
    },
    icon: 'Building2',
    colorClass: 'text-orange-600',
    borderClass: 'border-l-orange-500',
    bgClass: 'bg-orange-50',
    iconBgClass: 'bg-orange-100',
    order: 4,
  },
  {
    group: 'mechanical',
    entityLevels: ['building'],
    label: { el: 'Ηλεκτρομηχανολογικά (Η/Μ)', en: 'Mechanical / Electrical (MEP)' },
    description: {
      el: 'Ύδρευση, αποχέτευση, θέρμανση, κλιματισμός, ηλεκτρολογικά',
      en: 'Plumbing, drainage, heating, HVAC, electrical installations',
    },
    icon: 'Wrench',
    colorClass: 'text-red-600',
    borderClass: 'border-l-red-500',
    bgClass: 'bg-red-50',
    iconBgClass: 'bg-red-100',
    order: 5,
  },
  {
    group: 'energy',
    entityLevels: ['project'],
    label: { el: 'Ενεργειακά', en: 'Energy' },
    description: {
      el: 'ΜΕΑ/ΚΕΝΑΚ, ενεργειακό πιστοποιητικό, μόνωση',
      en: 'Energy study, energy certificate, insulation',
    },
    icon: 'Zap',
    colorClass: 'text-yellow-600',
    borderClass: 'border-l-yellow-500',
    bgClass: 'bg-yellow-50',
    iconBgClass: 'bg-yellow-100',
    order: 6,
  },
  {
    group: 'site',
    entityLevels: ['project'],
    label: { el: 'Εργοταξιακά / Περιβαλλοντικά', en: 'Site / Environmental' },
    description: {
      el: 'ΣΑΥ-ΦΑΥ, ΣΔΑ, χρονοδιάγραμμα, περιβαλλοντικοί όροι',
      en: 'Safety plans, waste management, schedule, environmental terms',
    },
    icon: 'HardHat',
    colorClass: 'text-teal-600',
    borderClass: 'border-l-teal-500',
    bgClass: 'bg-teal-50',
    iconBgClass: 'bg-teal-100',
    order: 7,
  },
] as const;

// ─── Lookup Helpers ──────────────────────────────────────────────────────────

const groupMetaMap = new Map<StudyGroup, StudyGroupMeta>(
  STUDY_GROUPS.map((g) => [g.group, g])
);

export function getStudyGroupMeta(group: StudyGroup): StudyGroupMeta | undefined {
  return groupMetaMap.get(group);
}

export function getStudyGroupsForEntity(entityLevel: EntityLevel): readonly StudyGroupMeta[] {
  return STUDY_GROUPS.filter((g) => g.entityLevels.includes(entityLevel));
}

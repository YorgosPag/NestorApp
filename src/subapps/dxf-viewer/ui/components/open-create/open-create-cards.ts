/**
 * open-create-cards — ο πίνακας του παραθύρου «Άνοιγμα / Δημιουργία» (ADR-914).
 *
 * Τρεις ενότητες, πέντε κάρτες, σε ΜΙΑ οθόνη. Pure: ποια κάρτα υπάρχει, πότε είναι ανενεργή και
 * γιατί — χωρίς React, ώστε οι κανόνες να δοκιμάζονται αυτόνομα και το παράθυρο να μένει
 * καθαρή παρουσίαση.
 *
 * @module subapps/dxf-viewer/ui/components/open-create/open-create-cards
 */

import type { ElementType } from 'react';
import { Boxes, FilePlus2, FolderOpen, PencilRuler, Upload } from 'lucide-react';
import type { ChoiceCardOption } from '@/components/ui/choice-cards';

/** Οι πέντε ενέργειες του παραθύρου. */
export type OpenCreateActionKind =
  | 'draft'
  | 'floorplanFor'
  | 'fromStorage'
  | 'importFloorplan'
  | 'importMesh3d';

export type OpenCreateSectionId = 'create' | 'open' | 'import';

/** Ό,τι χρειάζεται το παράθυρο για να ξέρει ποιες κάρτες δουλεύουν ΤΩΡΑ. */
export interface OpenCreateAvailability {
  /** Υπάρχει ανοιχτό επίπεδο — το 3Δ αρχείο εισάγεται πάνω του. */
  readonly hasOpenLevel: boolean;
  /**
   * Το ανοιχτό επίπεδο είναι δεμένο με όροφο/κτήριο/έργο — η φόρτωση από την αποθήκη γράφει
   * πάνω του και χρειάζεται να ξέρει από πού να διαβάσει.
   */
  readonly openLevelIsBound: boolean;
  /** Ο host μπορεί να παραλάβει εισαγόμενη σκηνή (`onSceneImported`)· αλλιώς η κάρτα δεν υπάρχει. */
  readonly canImportFloorplan: boolean;
}

export interface OpenCreateSection {
  readonly id: OpenCreateSectionId;
  readonly title: string;
  readonly cards: readonly ChoiceCardOption<OpenCreateActionKind>[];
}

type Translate = (key: string) => string;

interface CardSpec {
  readonly kind: OpenCreateActionKind;
  readonly icon: ElementType;
  /** `false` ⇒ η κάρτα δεν αποδίδεται καθόλου. */
  readonly offered?: (availability: OpenCreateAvailability) => boolean;
  /** `false` ⇒ ανενεργή, με τον λόγο της (`cards.<kind>.disabledReason`). */
  readonly enabled?: (availability: OpenCreateAvailability) => boolean;
}

const SECTION_SPECS: readonly { readonly id: OpenCreateSectionId; readonly cards: readonly CardSpec[] }[] = [
  {
    id: 'create',
    cards: [
      { kind: 'draft', icon: PencilRuler },
      { kind: 'floorplanFor', icon: FilePlus2 },
    ],
  },
  {
    id: 'open',
    cards: [
      { kind: 'fromStorage', icon: FolderOpen, enabled: (a) => a.openLevelIsBound },
    ],
  },
  {
    id: 'import',
    cards: [
      { kind: 'importFloorplan', icon: Upload, offered: (a) => a.canImportFloorplan },
      { kind: 'importMesh3d', icon: Boxes, enabled: (a) => a.hasOpenLevel },
    ],
  },
];

const KEY_ROOT = 'panels.openCreate';

function toCard(
  spec: CardSpec,
  availability: OpenCreateAvailability,
  t: Translate,
): ChoiceCardOption<OpenCreateActionKind> {
  const disabled = spec.enabled ? !spec.enabled(availability) : false;
  return {
    id: spec.kind,
    icon: spec.icon,
    title: t(`${KEY_ROOT}.cards.${spec.kind}.title`),
    description: t(`${KEY_ROOT}.cards.${spec.kind}.description`),
    tone: { icon: 'text-foreground', iconBackground: 'bg-muted', hoverBorder: 'hover:border-border' },
    disabled,
    ...(disabled ? { disabledReason: t(`${KEY_ROOT}.cards.${spec.kind}.disabledReason`) } : {}),
  };
}

/** Οι ενότητες με τις κάρτες τους, έτοιμες για απόδοση. Ενότητα χωρίς κάρτες παραλείπεται. */
export function buildOpenCreateSections(
  availability: OpenCreateAvailability,
  t: Translate,
): OpenCreateSection[] {
  return SECTION_SPECS
    .map((section) => ({
      id: section.id,
      title: t(`${KEY_ROOT}.sections.${section.id}`),
      cards: section.cards
        .filter((spec) => spec.offered?.(availability) ?? true)
        .map((spec) => toCard(spec, availability, t)),
    }))
    .filter((section) => section.cards.length > 0);
}

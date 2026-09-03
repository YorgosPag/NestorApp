import { useRef, useState, useCallback, useMemo } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ProjectAddress, PartialProjectAddress, BlockSideDirection, ProjectAddressType } from '@/types/project/addresses';
import { SELECT_CLEAR_VALUE } from '@/config/domain-constants';
import { AddressFormSection } from '@/components/shared/addresses/AddressFormSection';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { AddressEditor } from '@/components/shared/addresses/editor';
import type { AddressEditorHandle, ResolvedAddressFields } from '@/components/shared/addresses/editor';
import type { AddressWithHierarchyValue } from '@/components/shared/addresses/AddressWithHierarchy';
import {
  EMPTY_HIERARCHY,
  fromHierarchyValue,
  toHierarchyValue,
} from '@/components/projects/tabs/locations/location-converters';
import {
  hierarchyToResolvedAddress,
  storedAddressToResolved,
} from '@/utils/address/administrative-hierarchy';
import { addressListCenter } from '@/utils/address/address-list-center';
import { Button } from '@/components/ui/button';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { BuildingAddressEditorMode } from './building-addresses-card-types';

// =============================================================================
// PROPS
// =============================================================================

interface BuildingAddressesEditorProps {
  mode: BuildingAddressEditorMode;
  initialValues?: ProjectAddress;
  /**
   * Οι διευθύνσεις του **έργου** στο οποίο ανήκει το κτίριο — η αφετηρία από την οποία
   * κρίνεται ποιος υποψήφιος είναι «κοντά» (ADR-332 D23).
   *
   * 🔑 **Το έργο, όχι ο χάρτης**: το έργο εκφράζει **πρόθεση** (πού χτίζεις)· το κέντρο
   * προβολής εκφράζει **τι κοιτάς αυτή τη στιγμή**, που είναι τυχαίο. Μετρημένο: για
   * «Αθηνάς 5» χωρίς πόλη ο πάροχος δίνει πέντε αληθινές διευθύνσεις σε πέντε πόλεις —
   * αν η αφετηρία ήταν ο χάρτης, ένα απλό σύρσιμο θα ανέβαζε τη λάθος πόλη **πρώτη**.
   */
  projectAddresses?: readonly ProjectAddress[];
  /** @deprecated Kept for BuildingAddressesCard backward compat; ignored internally. */
  externalValues?: Partial<ProjectAddress> | null;
  /** @deprecated Kept for BuildingAddressesCard backward compat; called after drag confirm. */
  onExternalValuesChange?: (address: Partial<ProjectAddress> | null) => void;
  onChange: (address: Partial<ProjectAddress> | null) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaving: boolean;
}

interface EditorPresentation {
  titleKey: string;
  Icon: LucideIcon;
}

const EDITOR_PRESENTATION: Record<BuildingAddressEditorMode, EditorPresentation> = {
  create: { titleKey: 'address.labels.addAddress', Icon: Plus },
  edit: { titleKey: 'address.labels.editAddress', Icon: Pencil },
};

// =============================================================================
// CONVERTERS (local helpers)
// =============================================================================

/**
 * 🔴 **ADR-772** — τα τρία τοπικά αντίγραφα έφυγαν.
 *
 * Μετρημένο πριν: **5/8** διοικητικά επίπεδα και στις **δύο** κατευθύνσεις. Έλειπε η
 * **Δημοτική Ενότητα** — δηλαδή το *ίδιο ακριβώς* σφάλμα που το ADR-759 Φ3 διόρθωσε στον
 * μετατροπέα των έργων, ζωντανό εδώ, επειδή η Φ3 διόρθωσε το **δείγμα** και όχι την κλάση.
 * Έλειπαν επίσης `decentAdmin`, `majorGeo`, **και οι οκτώ ταυτότητες**, και το `country`
 * δεν διαβαζόταν καν.
 */
function toHierarchyFromAddr(addr?: Partial<ProjectAddress>): Partial<AddressWithHierarchyValue> {
  if (!addr) return {};
  return toHierarchyValue(addr);
}

function hierarchyToPartial(
  h: Partial<AddressWithHierarchyValue>,
  extra: { type: ProjectAddressType; blockSide: BlockSideDirection | typeof SELECT_CLEAR_VALUE; label: string; isPrimary: boolean },
): Partial<ProjectAddress> {
  return {
    ...fromHierarchyValue({ ...EMPTY_HIERARCHY, ...h }),
    type: extra.type,
    blockSide: extra.blockSide !== SELECT_CLEAR_VALUE ? (extra.blockSide as BlockSideDirection) : undefined,
    label: extra.label || undefined,
    isPrimary: extra.isPrimary,
  };
}

// ADR-772 / CHECK 3.28 — ήταν δίδυμο του `branchToResolvedFields` των επαφών.
function toResolvedFromAddr(addr: Partial<PartialProjectAddress>): ResolvedAddressFields {
  return storedAddressToResolved(addr, 'projectAddress');
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BuildingAddressesEditor({
  mode,
  initialValues,
  projectAddresses,
  onExternalValuesChange,
  onChange,
  onCancel,
  onSave,
  isSaving,
}: BuildingAddressesEditorProps) {
  const iconSizes = useIconSizes();
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const presentation = EDITOR_PRESENTATION[mode];

  // Local form state (initialized from initialValues; component re-mounts on mode change)
  const [hierarchy, setHierarchy] = useState<Partial<AddressWithHierarchyValue>>(
    () => toHierarchyFromAddr(initialValues),
  );
  const [type, setType] = useState<ProjectAddressType>(initialValues?.type ?? 'site');
  const [blockSide, setBlockSide] = useState<BlockSideDirection | typeof SELECT_CLEAR_VALUE>(
    initialValues?.blockSide ?? SELECT_CLEAR_VALUE,
  );
  const [label, setLabel] = useState(initialValues?.label ?? '');
  const [isPrimary, setIsPrimary] = useState(initialValues?.isPrimary ?? false);

  const editorRef = useRef<AddressEditorHandle>(null);

  /**
   * Πού να μετρηθεί το «κοντά»: **το έργο**, και αν εκείνο δεν έχει ακόμη θέση, η ήδη
   * αποθηκευμένη θέση **αυτής** της εγγραφής. Αν λείπουν και τα δύο, `undefined` —
   * η κατάταξη γίνεται μόνο με βεβαιότητα και **δεν** μαντεύεται σημείο.
   */
  const proximityAnchor = useMemo(
    () => addressListCenter(projectAddresses) ?? addressListCenter(initialValues ? [initialValues] : []),
    [projectAddresses, initialValues],
  );

  const resolvedValue = useMemo(
    () => hierarchyToResolvedAddress(hierarchy),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(hierarchy as AddressWithHierarchyValue).street, (hierarchy as AddressWithHierarchyValue).number,
     (hierarchy as AddressWithHierarchyValue).postalCode, (hierarchy as AddressWithHierarchyValue).settlementName],
  );

  const notifyParent = useCallback((h: Partial<AddressWithHierarchyValue>, t: ProjectAddressType, bs: BlockSideDirection | typeof SELECT_CLEAR_VALUE, lbl: string, prim: boolean) => {
    onChange(hierarchyToPartial(h, { type: t, blockSide: bs, label: lbl, isPrimary: prim }));
  }, [onChange]);

  const handleHierarchyChange = useCallback((val: Partial<AddressWithHierarchyValue>) => {
    setHierarchy(val);
    notifyParent(val, type, blockSide, label, isPrimary);
  }, [notifyParent, type, blockSide, label, isPrimary]);

  const handleTypeChange = useCallback((val: ProjectAddressType) => {
    setType(val);
    notifyParent(hierarchy, val, blockSide, label, isPrimary);
  }, [notifyParent, hierarchy, blockSide, label, isPrimary]);

  const handleBlockSideChange = useCallback((val: BlockSideDirection | typeof SELECT_CLEAR_VALUE) => {
    setBlockSide(val);
    notifyParent(hierarchy, type, val, label, isPrimary);
  }, [notifyParent, hierarchy, type, label, isPrimary]);

  const handleLabelChange = useCallback((val: string) => {
    setLabel(val);
    notifyParent(hierarchy, type, blockSide, val, isPrimary);
  }, [notifyParent, hierarchy, type, blockSide, isPrimary]);

  const handleIsPrimaryChange = useCallback((val: boolean) => {
    setIsPrimary(val);
    notifyParent(hierarchy, type, blockSide, label, val);
  }, [notifyParent, hierarchy, type, blockSide, label]);

  // Geocoding / undo / suggestion → merge resolved basic fields into hierarchy
  const handleEditorChange = useCallback((resolved: ResolvedAddressFields) => {
    const updated: Partial<AddressWithHierarchyValue> = {
      ...hierarchy,
      street: resolved.street ?? (hierarchy as AddressWithHierarchyValue).street ?? '',
      number: resolved.number ?? (hierarchy as AddressWithHierarchyValue).number ?? '',
      postalCode: resolved.postalCode ?? (hierarchy as AddressWithHierarchyValue).postalCode ?? '',
      settlementName: resolved.city ?? (hierarchy as AddressWithHierarchyValue).settlementName ?? '',
    };
    setHierarchy(updated);
    notifyParent(updated, type, blockSide, label, isPrimary);
  }, [hierarchy, notifyParent, type, blockSide, label, isPrimary]);

  // Drag confirmed → clear ELSTAT hierarchy, set basic fields
  const handleDragApplied = useCallback((resolved: ResolvedAddressFields) => {
    const updated: Partial<AddressWithHierarchyValue> = {
      street: resolved.street ?? '',
      number: resolved.number ?? '',
      postalCode: resolved.postalCode ?? '',
      settlementName: resolved.city ?? '',
      communityName: resolved.neighborhood ?? '',
      regionName: resolved.region ?? '',
      communityId: null, municipalUnitName: '', municipalUnitId: null,
      municipalityName: '', municipalityId: null, regionalUnitName: '',
      regionalUnitId: null, regionId: null, decentAdminName: '', majorGeoName: '',
    };
    setHierarchy(updated);
    const partial = hierarchyToPartial(updated, { type, blockSide, label, isPrimary });
    onChange(partial);
    onExternalValuesChange?.(partial);
  }, [onChange, onExternalValuesChange, type, blockSide, label, isPrimary]);

  return (
    <section className="border-2 border-primary rounded-lg p-2 bg-card space-y-2">
      <header className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <presentation.Icon className={iconSizes.md} />
          {t(presentation.titleKey)}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className={iconSizes.sm} />
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* AddressEditor: activity log, field badges, reconciliation, drag confirm */}
          <AddressEditor
            ref={editorRef}
            value={resolvedValue}
            onChange={handleEditorChange}
            onDragApplied={handleDragApplied}
            mode="edit"
            domain="building"
            suggestions={{ proximityAnchor }}
            formOptions={{ hideGrid: true }}
            activityLog={{ collapsed: true }}
          >
            <AddressFormSection
              value={hierarchy}
              onChange={handleHierarchyChange}
              type={type}
              blockSide={blockSide}
              label={label}
              isPrimary={isPrimary}
              onTypeChange={handleTypeChange}
              onBlockSideChange={handleBlockSideChange}
              onLabelChange={handleLabelChange}
              onIsPrimaryChange={handleIsPrimaryChange}
            />
          </AddressEditor>

          <footer className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              {t('tabs.general.header.cancel')}
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving ? t('tabs.general.header.saving') : t('tabs.general.header.save')}
            </Button>
          </footer>
        </div>

        <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-12rem)]">
          <AddressMap
            addresses={initialValues ? [initialValues] : []}
            draggableMarkers
            onAddressDragUpdate={(dragAddr) => editorRef.current?.setPendingDrag(toResolvedFromAddr(dragAddr))}
            heightPreset="viewerFullscreen"
            className="rounded-lg border shadow-sm !h-full"
          />
        </aside>
      </div>
    </section>
  );
}

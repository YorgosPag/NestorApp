/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { Project } from '@/types/project';
import type { ProjectAddressType } from '@/types/project/addresses';
import { SharedAddressActionCard } from '@/components/shared/addresses/SharedAddressActionCard';
import { AddressPublicShapeBadge } from '@/components/shared/addresses/AddressPublicShapeBadge';
import { AddressPositionDriftNotice } from '@/components/shared/addresses/AddressPositionDriftNotice';
import { ADDRESS_TYPE_KEYS, isUniqueAddressType } from './locations/address-constants';
import { AddressMap } from '@/components/shared/addresses/AddressMap';
import { AddressMapCandidateLayer } from '@/components/shared/addresses/AddressMapCandidateLayer';
import {
  useSuggestionMapBond,
  useSuggestionOptions,
} from '@/components/shared/addresses/useSuggestionMapBond';
import { Button } from '@/components/ui/button';
import { MapPin, Plus } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getPrimaryAddress } from '@/types/project/address-helpers';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useFullscreen } from '@/hooks/useFullscreen';
import { resolveProximityAnchor } from '@/utils/address/proximity-anchor';
import { formatContactAddressLine } from '@/utils/address/address-line';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { cn } from '@/lib/utils';
import { LocationInlineForm } from './locations/LocationInlineForm';
import { useProjectLocations } from './locations/useProjectLocations';
import type { DragApplyMode } from './locations/location-converters';
import { ProjectViewDragConfirm } from './locations/ProjectViewDragConfirm';
import { useLocationsDragRouting, useLocationsMapModel } from './locations/useLocationsMap';
import type { AddressEditorHandle } from '@/components/shared/addresses/editor';

// =============================================================================
// TYPES
// =============================================================================

interface ProjectLocationsTabProps {
  data: Project;
  projectId?: string;
  /** Ignored — this tab uses always-on inline editing (no global edit toggle). */
  isEditing?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectLocationsTab({ data: project }: ProjectLocationsTabProps) {
  // Inline-only editing: New Address button and per-card actions are always
  // available. The header Edit toggle is hidden for this tab (project-details).
  const isEditing = true;
  const { t } = useTranslation('addresses');
  const { t: tProjects } = useTranslation(['projects', 'projects-data', 'projects-ika']);
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  const fullscreen = useFullscreen();

  const loc = useProjectLocations(project);
  const _primary = getPrimaryAddress(loc.localAddresses);

  // ADR-332 Phase 7: editor refs for drag → confirm dialog
  const addEditorRef = useRef<AddressEditorHandle>(null);
  const editEditorRef = useRef<AddressEditorHandle>(null);
  const [undoRedoCount, setUndoRedoCount] = useState(0);
  const handleUndoRedo = useCallback(() => setUndoRedoCount(n => n + 1), []);

  // Ghost addresses (street='' AND city='') are produced by handleClearPrimaryAddress
  // to preserve the isPrimary slot. Filter them out of view-mode list AND map —
  // otherwise edit mode places a fallback pin at the Athens default center.
  const visibleAddresses = useMemo(
    () => loc.localAddresses
      .map((address, originalIndex) => ({ address, originalIndex }))
      .filter(({ address }) => !((address.street ?? '') === '' && (address.city ?? '') === '')),
    [loc.localAddresses],
  );

  /**
   * 🔑 **Η ΑΦΕΤΗΡΙΑ ΕΓΓΥΤΗΤΑΣ ΤΩΝ ΠΡΟΤΑΣΕΩΝ** — ADR-332 **D25** *(ο κανόνας είναι του D23)*.
   *
   * «Από πού μετράμε το κοντά;» ⇒ **από τις άλλες διευθύνσεις του ίδιου έργου**. Για
   * «Αθηνάς 5» χωρίς τοπωνύμιο ο πάροχος δίνει **πέντε αληθινές** διευθύνσεις σε πέντε
   * πόλεις (212-349 km)· χωρίς αφετηρία η σειρά τους βγαίνει μόνο από τη βεβαιότητα.
   *
   * ⛔ **ΠΟΤΕ το κέντρο προβολής του χάρτη** (D23): το έργο εκφράζει *πρόθεση*, ο χάρτης
   * *τι κοιτάς τώρα*. Ένα σύρσιμο θα ανέβαζε τη λάθος πόλη **πρώτη**.
   *
   * ⛔ **ΚΑΙ ΠΟΤΕ το `pendingDragCoords`** της φόρμας προσθήκης: εκείνο είναι
   * *τοποθέτηση πινέζας για να πιαστεί* — κεντροειδές, ή μετατόπιση 150 m, ή το
   * **προεπιλεγμένο κέντρο Αθήνας** όταν δεν υπάρχει καμία θέση. Το τελευταίο είναι
   * ακριβώς η αστοχία που απέρριψε το D23, από άλλη πόρτα.
   *
   * ⚠️ **Η μία λίστα αρκεί για ΚΑΙ ΤΙΣ ΔΥΟ φόρμες**: στην προσθήκη δίνει το σημείο του
   * έργου· στην επεξεργασία, αν η εγγραφή που διορθώνεται είναι η κύρια, δίνει τη **δική
   * της αποθηκευμένη θέση** — που είναι κατά λέξη η δηλωμένη υποχώρηση του D23.
   *
   * ⚠️ Οι «φαντάσματα» (`street==='' && city===''`) περνούν αθώα: το
   * `handleClearPrimaryAddress` τα φτιάχνει με `createProjectAddress` **χωρίς
   * συντεταγμένες**, και το `addressListCenter` απορρίπτει δομικά ό,τι δεν έχει θέση.
   */
  const entityAnchor = useMemo(
    () => resolveProximityAnchor({ addresses: loc.localAddresses }),
    [loc.localAddresses],
  );

  /**
   * 🔑 **Η ΦΟΡΜΑ ΠΡΟΣΘΗΚΗΣ ΑΚΟΥΕΙ ΠΡΩΤΑ ΤΟΝ ΑΝΘΡΩΠΟ** — ADR-332 D25 §πινέζα, **απόφαση
   * Giorgio 05/09**. Αν ο άνθρωπος έσυρε την πινέζα πριν πληκτρολογήσει, είπε **«εδώ»**·
   * καμία συναγωγή από τη λίστα δεν είναι ισχυρότερη από αυτό. Έργο στη Θεσσαλονίκη με
   * νέα διεύθυνση στην Καλαμαριά κατατάσσει σωστά **μόνο** έτσι.
   *
   * ⚠️ Το `humanPlacedPoint` είναι **ήδη διακριμένο** από το hook: `null` όσο η πινέζα
   * κάθεται στη μαντεμένη θέση. Ο τύπος του πεδίου δεν δέχεται σημαία «το έσυρε;» —
   * επίτηδες, ώστε να μη γίνεται να ξεχαστεί *(βλ. `utils/address/proximity-anchor`)*.
   */
  const addFormAnchor = useMemo(
    () => resolveProximityAnchor({
      humanPlacedPoint: loc.humanPlacedPoint,
      addresses: loc.localAddresses,
    }),
    [loc.humanPlacedPoint, loc.localAddresses],
  );

  /*
    ⛔ **Η ΦΟΡΜΑ ΕΠΕΞΕΡΓΑΣΙΑΣ ΔΕΝ ΠΑΙΡΝΕΙ ΤΗΝ ΠΙΝΕΖΑ ΤΗΣ ΠΡΟΣΘΗΚΗΣ, ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΟ.**
    Η εκκρεμής πινέζα ανήκει **αποκλειστικά** στη ροή προσθήκης. Από το ADR-332 D27 Βήμα Β
    η επεξεργασία κρατά **δική της** ανθρώπινη θέση (`editPlacedPoint` — ίδιο hook, άλλο
    όνομα), που **αποθηκεύεται** αλλά **δεν** τροφοδοτεί την αφετηρία: εκεί μένει η λίστα.

    Θα ήταν εύκολο να δοθεί **μία** αφετηρία και στις δύο φόρμες, βασισμένο στο ότι το
    `humanPlacedPoint` «τυχαίνει» να είναι `null` στην επεξεργασία *(η πινέζα καθαρίζεται
    στο `handleCancelAdd`, και οι δύο φόρμες δεν συνυπάρχουν)*. Αυτό όμως είναι
    **συμπερασμός από μηχανή καταστάσεων**, όχι εγγύηση: αρκεί μια μελλοντική διαδρομή
    που δεν καθαρίζει, για να μεταφερθεί σιωπηλά η πινέζα της προσθήκης σε άλλη εγγραφή.
    Δύο ονόματα κοστίζουν δύο γραμμές και κάνουν τη διαρροή **αδύνατη**.
  */

  // Unique address types already in use. `other` is excluded from this set so
  // that it can be picked multiple times.
  const usedUniqueTypes = useMemo(
    () => new Set(
      visibleAddresses
        .map(({ address }) => address.type)
        .filter(isUniqueAddressType),
    ),
    [visibleAddresses],
  );

  // Add form: drop unique types already used. `other` always remains.
  const availableTypesForAdd = useMemo<readonly ProjectAddressType[]>(
    () => ADDRESS_TYPE_KEYS.filter(t => !isUniqueAddressType(t) || !usedUniqueTypes.has(t)),
    [usedUniqueTypes],
  );

  // Edit form: drop unique types already used by OTHER addresses, but always
  // keep the type currently assigned to the address being edited so the
  // dropdown can render its current selection.
  const editingType = loc.editingIndex !== null
    ? loc.localAddresses[loc.editingIndex]?.type
    : undefined;
  const availableTypesForEdit = useMemo<readonly ProjectAddressType[]>(
    () => ADDRESS_TYPE_KEYS.filter(t =>
      !isUniqueAddressType(t) || !usedUniqueTypes.has(t) || t === editingType,
    ),
    [usedUniqueTypes, editingType],
  );

  // ADR-332 D27 Βήμα Β — ο χάρτης δείχνει ό,τι ΘΑ αποθηκευτεί (βλ. `useLocationsMap`).
  const { activeEditingAddressId, readOnlyAddressIds, mapAddresses } = useLocationsMapModel({
    visibleAddresses,
    localAddresses: loc.localAddresses,
    isAddFormOpen: loc.isAddFormOpen,
    editingIndex: loc.editingIndex,
    pendingDragCoords: loc.pendingDragCoords,
    editPlacedPoint: loc.editPlacedPoint,
  });
  /**
   * 🔴 **Ο ΔΕΣΜΟΣ ΚΑΤΑΛΟΓΟΥ ⇄ ΧΑΡΤΗ** — ADR-332 **D26**. Ως τις 05/09 ο κατάλογος
   * «Πιθανές Τοποθεσίες» έδειχνε πέντε αληθινές διευθύνσεις σε **292-318 χλμ** και **καμία
   * τους δεν υπήρχε στον χάρτη δεξιά**: ο άνθρωπος διάλεγε στα τυφλά.
   *
   * ⚠️ **Ένας δεσμός για ΔΥΟ φόρμες, και δεν είναι παράλειψη.** Οι δύο φόρμες δεν
   * συνυπάρχουν ποτέ, αλλά αυτό είναι **συμπερασμός από μηχανή καταστάσεων** — ακριβώς ο
   * τύπος υπόθεσης που το D25 απέρριψε για την αφετηρία. Εδώ δεν χρειάζεται: η αναφορά
   * κουβαλά **τη δική της** πράξη επιλογής και **τη δική της** αφετηρία
   * (`SuggestionMapReport`), οπότε δεν υπάρχει τίποτα να δρομολογηθεί λάθος.
   */
  const candidateBond = useSuggestionMapBond();
  const addSuggestions = useSuggestionOptions(candidateBond, addFormAnchor);
  const editSuggestions = useSuggestionOptions(candidateBond, entityAnchor);

  // Φ2β — η απόκλιση κάθε κρατημένης πινέζας, ανά ταυτότητα διεύθυνσης.
  const driftById = useMemo(
    () => new Map(loc.positionAdvisories.map((advisory) => [advisory.addressId, advisory])),
    [loc.positionAdvisories],
  );

  // ADR-332 Phase 7 + D27 Βήμα Β: σύρσιμο → διάλογος → και ΜΟΝΟ μετά θέση (βλ. `useLocationsMap`).
  const { pendingViewDrag, clearViewDrag, handleCombinedDragUpdate } = useLocationsDragRouting({
    visibleAddresses,
    isAddFormOpen: loc.isAddFormOpen,
    editingIndex: loc.editingIndex,
    addEditorRef,
    editEditorRef,
  });

  const handleViewDragConfirm = useCallback(async (mode: DragApplyMode) => {
    if (!pendingViewDrag) return;
    await loc.handleAddressDragUpdate(pendingViewDrag.drop, pendingViewDrag.originalIndex, mode);
    clearViewDrag();
  }, [pendingViewDrag, loc.handleAddressDragUpdate, clearViewDrag]);

  const handleViewDragCancel = useCallback(() => {
    clearViewDrag();
    setUndoRedoCount(n => n + 1);
  }, [clearViewDrag]);

  return (
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel={t('locations.title')}
      className="grid grid-cols-1 lg:grid-cols-2 gap-2"
      fullscreenClassName="grid grid-cols-1 lg:grid-cols-2 gap-2 p-2 overflow-auto"
    >
      {/* LEFT: Toolbar + forms + address cards */}
      <div className={spacing.spaceBetween.sm}>

        {/* Toolbar: fullscreen toggle (left) + add button (right) */}
        <div className="flex items-center justify-between">
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
          {isEditing && !loc.isAddFormOpen && loc.editingIndex === null && (
            <Button onClick={loc.handleOpenAddForm} variant="default" size="sm">
              <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
              {t('locations.newAddress')}
            </Button>
          )}
        </div>

        {/* Inline Add Form — ref routes map drag to confirm dialog */}
        {isEditing && loc.isAddFormOpen && (
          <LocationInlineForm
            ref={addEditorRef}
            mode="add"
            hierarchy={loc.addHierarchy}
            onHierarchyChange={loc.setAddHierarchy}
            type={loc.addType}
            blockSide={loc.addBlockSide}
            label={loc.addLabel}
            isPrimary={loc.addIsPrimary}
            onTypeChange={loc.setAddType}
            onBlockSideChange={loc.setAddBlockSide}
            onLabelChange={loc.setAddLabel}
            onIsPrimaryChange={loc.setAddIsPrimary}
            isSaving={loc.isSaving}
            onSave={loc.handleSaveNewAddress}
            onCancel={loc.handleCancelAdd}
            onUndoRedo={handleUndoRedo}
            t={t}
            tProjects={tProjects}
            availableTypes={availableTypesForAdd}
            suggestions={addSuggestions}
            placement={loc.addPlacement}
          />
        )}

        {/* Inline Edit Form — ref routes map drag to confirm dialog */}
        {isEditing && loc.editingIndex !== null && !loc.isAddFormOpen && (
          <LocationInlineForm
            ref={editEditorRef}
            mode="edit"
            hierarchy={loc.editHierarchy}
            onHierarchyChange={loc.setEditHierarchy}
            type={loc.editType}
            blockSide={loc.editBlockSide}
            label={loc.editLabel}
            isPrimary={loc.editIsPrimary}
            onTypeChange={loc.setEditType}
            onBlockSideChange={loc.setEditBlockSide}
            onLabelChange={loc.setEditLabel}
            onIsPrimaryChange={loc.handleEditIsPrimaryChange}
            isSaving={loc.isSaving}
            onSave={loc.handleSaveEdit}
            onCancel={loc.handleCancelEdit}
            onUndoRedo={handleUndoRedo}
            t={t}
            availableTypes={availableTypesForEdit}
            tProjects={tProjects}
            suggestions={editSuggestions}
            placement={loc.editPlacement}
          />
        )}

        {/* Address Cards (view mode) */}
        {!loc.isInlineFormActive && (
          <>
            {visibleAddresses.length === 0 ? (
              <div className={cn('text-center border-2 border-dashed rounded-lg', spacing.padding.y['2xl'])}>
                <MapPin className={cn(iconSizes.xl, 'mx-auto', colors.text.muted, spacing.margin.bottom.md)} />
                <h3 className={cn(typography.heading.md, spacing.margin.bottom.sm)}>{t('locations.noAddresses')}</h3>
                <p className={cn(typography.body.sm, colors.text.muted)}>
                  {t('locations.noAddressesHint')}
                </p>
              </div>
            ) : (
              <aside className={spacing.spaceBetween.md}>
                <h3 className={typography.heading.md}>
                  {t('locations.projectAddresses')} ({visibleAddresses.length})
                </h3>
                {visibleAddresses.map(({ address, originalIndex }) => {
                  // Β7 — ΕΝΑ SSoT γραμμής διεύθυνσης (Τ.Κ. ΕΛΤΑ, χωρίς ορφανά κόμματα).
                  const streetLine = formatContactAddressLine(address);
                  const drift = driftById.get(address.id);
                  const typeLabel = t(`types.${address.type}`);
                  const isPrimary = address.isPrimary;

                  return (
                    <SharedAddressActionCard
                      key={address.id}
                      id={address.id}
                      streetLine={streetLine}
                      typeLabel={typeLabel}
                      isPrimary={isPrimary}
                      isEditing={isEditing}
                      onEdit={() => loc.handleStartEdit(originalIndex)}
                      onSetPrimary={!isPrimary ? () => loc.handleSetPrimary(originalIndex) : undefined}
                      onClear={originalIndex === 0 ? loc.handleClearPrimaryAddress : undefined}
                      onDelete={originalIndex !== 0 ? () => loc.handleRequestDelete(originalIndex) : undefined}
                      editLabel={t('card.edit')}
                      clearLabel={tProjects('locations.clearAddress')}
                      deleteLabel={t('deleteDialog.confirm')}
                      setPrimaryLabel={tProjects('common.setAsPrimary')}
                      primaryLabel={tProjects('common.primary')}
                      /*
                        🔴 **Η ΣΕΙΡΑ ΕΜΠΛΟΥΤΙΣΜΟΥ ΗΤΑΝ ΔΟΜΙΚΑ ΝΕΚΡΗ** (ADR-332 Φ8):
                        `grep -rn "hasCoordinates=" src/` → **0 σημεία κλήσης** σε ολόκληρη
                        την εφαρμογή. Τρία component χτισμένα και **ποτέ αποδοθέντα** — γιατί
                        τα πεδία που τρέφονται (`source`/`verifiedAt`/`geocodingMetadata`)
                        είχαν **12 αναγνώστες και 0 γραφείς**. Τώρα τα γράφει ο ένας γραφέας
                        θέσης (`lib/geocoding/address-position.ts`), οπότε έχουν τι να πουν.
                      */
                      source={address.source}
                      verifiedAt={address.verifiedAt ?? null}
                      hasCoordinates={Boolean(address.coordinates)}
                      /*
                        Η **συνέπεια**, δίπλα στη θεραπεία (Α5 §4.3: *«το γέμισμα της θέσης
                        είναι το δόλωμα, ποτέ το φράγμα»*). Ο επαγγελματίας βλέπει εδώ τι θα
                        δει ο επισκέπτης — όχι μια συντεταγμένη που δεν μπορεί να κρίνει.
                      */
                      footer={
                        <>
                          <AddressPublicShapeBadge
                            coordinates={address.coordinates ?? null}
                            geocodingMetadata={address.geocodingMetadata ?? null}
                          />
                          {/* ADR-332 D27 Βήμα Β (Φ2β) — η πινέζα έμεινε· πόσο απέχει από τη νέα διεύθυνση; */}
                          {drift && (
                            <AddressPositionDriftNotice
                              distanceMetres={drift.distanceMetres}
                              busy={loc.isSaving}
                              onRelocate={() => { void loc.handleRelocateAddress(address.id); }}
                              onKeep={() => loc.handleKeepAddressPin(address.id)}
                            />
                          )}
                        </>
                      }
                    />
                  );
                })}
              </aside>
            )}
          </>
        )}
      </div>

      {/* RIGHT: Map — always visible, draggable in edit mode.
          Draggable only when there is something to drag (real address or pending add).
          Disables AddressMap's empty-list fallback marker so no ghost Athens pin
          appears when entering edit mode with zero addresses. */}
      <aside className="lg:sticky lg:top-0 lg:self-start lg:h-[calc(100vh-7rem)]">
        <AddressMap
          addresses={mapAddresses}
          highlightPrimary
          showGeocodingStatus
          enableClickToFocus
          onMarkerClick={loc.handleMarkerClick}
          draggableMarkers={isEditing && mapAddresses.length > 0}
          onAddressDragUpdate={handleCombinedDragUpdate}
          readOnlyAddressIds={readOnlyAddressIds}
          activeEditingAddressId={activeEditingAddressId}
          dragResetKey={undoRedoCount}
          heightPreset="viewerFullscreen"
          className="rounded-lg border shadow-sm !h-full"
          /*
            ADR-332 D26 — οι υποψήφιοι ζωγραφίζονται **στον ίδιο χάρτη** χωρίς να γίνουν
            διευθύνσεις: δεν γεωκωδικοποιούνται, δεν σύρονται, δεν μετακινούν την κάμερα.
            Το τελευταίο είναι **απόφαση**, όχι παράλειψη: το αυτόματο fit-bounds θα
            πετούσε τον άνθρωπο σε μισή Ελλάδα κάθε φορά που εμφανίζεται ο κατάλογος.
          */
          overlay={candidateBond.candidates.length > 0 ? (
            <AddressMapCandidateLayer
              candidates={candidateBond.candidates}
              highlightedRank={candidateBond.highlightedRank}
              onHighlight={candidateBond.setHighlightedRank}
              onSelect={candidateBond.select}
              anchor={candidateBond.anchor}
            />
          ) : undefined}
        />
      </aside>

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={loc.deleteDialogOpen}
        onOpenChange={loc.setDeleteDialogOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description')}
        onConfirm={loc.handleConfirmDelete}
        confirmText={t('deleteDialog.confirm')}
        cancelText={t('deleteDialog.cancel')}
      />

      {/* View-mode drag confirm — fires when real pin dragged with no form open */}
      {pendingViewDrag !== null && (
        <ProjectViewDragConfirm
          target={visibleAddresses.find(({ originalIndex }) => originalIndex === pendingViewDrag.originalIndex)?.address}
          drop={pendingViewDrag.drop}
          onConfirm={(mode) => { void handleViewDragConfirm(mode); }}
          onCancel={handleViewDragCancel}
        />
      )}
    </FullscreenOverlay>
  );
}

export default ProjectLocationsTab;

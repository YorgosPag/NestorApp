/**
 * LEVELS SYSTEM - Utilities
 * Level and floorplan operations and helper functions
 */

import type { Level, FloorplanDoc, CalibrationData } from './config';
// 🏢 ADR-065: Centralized ID Generation (crypto-secure, collision-resistant)
import { generateLayerId, generateFloorId } from '@/services/enterprise-id.service';
import { nowISO } from '@/lib/date-local';
import i18next from 'i18next';
import type { FloorplanType, LevelBirthBinding } from './config';

/** Μηνύματα επικύρωσης ονόματος — κλειδιά, όχι κείμενο (N.11). Χωρίς φορτωμένο i18n μένει το κλειδί. */
const LEVEL_NAME_ERROR_KEYS = {
  empty: 'dxf-viewer-panels:panels.levels.nameErrors.empty',
  duplicate: 'dxf-viewer-panels:panels.levels.nameErrors.duplicate',
} as const;

function levelNameError(kind: keyof typeof LEVEL_NAME_ERROR_KEYS): string {
  const key = LEVEL_NAME_ERROR_KEYS[kind];
  return i18next.t(key) || key;
}

/**
 * Τα επίπεδα μέσα στα οποία ένα όνομα πρέπει να είναι μοναδικό — ο ΙΔΙΟΣ κανόνας με τον
 * διακομιστή (`handleCreateDxfLevel`, ADR-845 §7.15): μέσα στο κτήριό του όταν έχει κτήριο,
 * αλλιώς σε όλα τα επίπεδα του μισθωτή.
 */
export function levelsSharingNameScope<T extends Pick<Level, 'buildingId'>>(
  levels: readonly T[],
  buildingId: string | null | undefined,
): readonly T[] {
  return buildingId ? levels.filter((l) => l.buildingId === buildingId) : levels;
}

/**
 * Η δέσμευση γέννησης ως πεδία εγγραφής (ADR-914) — ΜΙΑ μετάφραση για το σώμα του
 * `POST /api/dxf-levels` και για το in-memory επίπεδο. Ό,τι λείπει **παραλείπεται**: στη
 * γέννηση δεν υπάρχει `null`/`undefined` στο σώμα (το σχήμα δημιουργίας δεν τα δέχεται).
 */
export function levelBirthFields(
  birth: LevelBirthBinding | undefined,
): Pick<Level, 'buildingId' | 'projectId' | 'propertyId' | 'floorplanType' | 'entityLabel'> {
  return {
    ...(birth?.buildingId ? { buildingId: birth.buildingId } : {}),
    ...(birth?.projectId ? { projectId: birth.projectId } : {}),
    ...(birth?.propertyId ? { propertyId: birth.propertyId } : {}),
    ...(birth?.floorplanType ? { floorplanType: birth.floorplanType } : {}),
    ...(birth?.entityLabel ? { entityLabel: birth.entityLabel } : {}),
  };
}

/** Ό,τι ορίζει ένα επίπεδο τη στιγμή που γεννιέται — τα ίδια ορίσματα με το `addLevel`. */
export interface NewLevelSpec {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly isDefault: boolean;
  readonly floorId?: string;
  readonly birth?: LevelBirthBinding;
}

/**
 * Το επίπεδο όπως γεννιέται — ΜΙΑ κατασκευή για το in-memory σύστημα και για το επίπεδο που
 * μπαίνει στη λίστα πριν από την ηχώ της συνδρομής (ADR-914 §2.9). Τα πεδία δέσμευσης είναι
 * ακριβώς όσα ταξιδεύουν στο `POST /api/dxf-levels` ({@link levelBirthFields}), ώστε ο στόχος
 * γέννησης του ADR-913 να βγαίνει ίδιος πριν και μετά την ηχώ.
 */
export function buildNewLevel({ id, name, order, isDefault, floorId, birth }: NewLevelSpec): Level {
  return {
    id,
    name,
    order,
    isDefault,
    visible: true,
    ...(floorId ? { floorId } : {}),
    ...levelBirthFields(birth),
  };
}

/** Ένα έγγραφο επιπέδου όπως το επιστρέφει ο διακομιστής — `null` όπου το πεδίο είναι κενό. */
type ServerLevelDocument = { readonly id: string; readonly name: string; readonly order: number } & Readonly<
  Record<string, unknown>
>;

const textField = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

const FLOORPLAN_TYPES: readonly FloorplanType[] = ['project', 'building', 'floor', 'unit'];

/**
 * Έγγραφο του `GET /api/dxf-levels` → `Level` του viewer: μόνο η ταυτότητα και η δέσμευση, με
 * το `null` του διακομιστή γραμμένο ως απουσία (ο τύπος `Level` δεν έχει `null`). Ό,τι χρειάζεται
 * για να **βρεθεί** και να **ανοίξει** ένα επίπεδο πριν το φέρει η συνδρομή (ADR-914 §2.11) — τα
 * υπόλοιπα πεδία έρχονται με την ηχώ.
 */
export function levelFromServerDocument(doc: ServerLevelDocument): Level {
  const floorplanType = FLOORPLAN_TYPES.find((type) => type === doc.floorplanType);
  return {
    id: doc.id,
    name: doc.name,
    order: doc.order,
    isDefault: doc.isDefault === true,
    visible: doc.visible !== false,
    companyId: textField(doc.companyId),
    floorId: textField(doc.floorId),
    buildingId: textField(doc.buildingId),
    projectId: textField(doc.projectId),
    propertyId: textField(doc.propertyId),
    sceneFileId: textField(doc.sceneFileId),
    sceneFileName: textField(doc.sceneFileName),
    entityLabel: textField(doc.entityLabel),
    ...(floorplanType ? { floorplanType } : {}),
  };
}

export class LevelOperations {
  static createDefaultLevels(): Level[] {
    return [
      { id: 'default', name: 'Επίπεδο 1', order: 0, isDefault: true, visible: true },
    ];
  }

  /**
   * @param buildingId Το κτήριο του επιπέδου που ονομάζεται — στενεύει τη μοναδικότητα στο
   *                   κτήριο (βλ. {@link levelsSharingNameScope}). Απόν ⇒ όλα τα επίπεδα.
   */
  static validateLevelName(
    name: string,
    existingLevels: readonly Level[],
    buildingId?: string | null,
  ): string | null {
    if (!name.trim()) return levelNameError('empty');

    const wanted = name.toLowerCase();
    if (levelsSharingNameScope(existingLevels, buildingId).some(l => l.name.toLowerCase() === wanted)) {
      return levelNameError('duplicate');
    }

    return null;
  }

  static generateLevelId(): string {
    // 🏢 ADR-065: Crypto-secure, collision-resistant ID generation
    return generateLayerId();
  }

  static getNextOrder(levels: Level[]): number {
    return Math.max(...levels.map(l => l.order), -1) + 1;
  }

  static addLevel(
    levels: Level[],
    name: string,
    setAsDefault = false,
    floorId?: string,
    birth?: LevelBirthBinding
  ): { levels: Level[]; newLevelId: string } {
    const id = LevelOperations.generateLevelId();
    const order = LevelOperations.getNextOrder(levels);

    const newLevel = buildNewLevel({ id, name, order, isDefault: setAsDefault, floorId, birth });

    const updatedLevels = setAsDefault
      ? [...levels.map(l => ({ ...l, isDefault: false })), newLevel]
      : [...levels, newLevel];

    return { levels: updatedLevels, newLevelId: id };
  }

  static removeLevel(levels: Level[], levelId: string): Level[] {
    return levels.filter(l => l.id !== levelId);
  }

  static reorderLevels(levels: Level[], levelIds: string[]): Level[] {
    return levelIds.map((id, index) => {
      const level = levels.find(l => l.id === id);
      return level ? { ...level, order: index } : level;
    }).filter(Boolean) as Level[];
  }

  static renameLevel(levels: Level[], levelId: string, name: string): Level[] {
    return levels.map(l => 
      l.id === levelId ? { ...l, name } : l
    );
  }

  static toggleLevelVisibility(levels: Level[], levelId: string): Level[] {
    return levels.map(l => 
      l.id === levelId ? { ...l, visible: !l.visible } : l
    );
  }

  static setDefaultLevel(levels: Level[], levelId: string): Level[] {
    return levels.map(l => ({
      ...l,
      isDefault: l.id === levelId
    }));
  }

  static getVisibleLevels(levels: Level[]): Level[] {
    return levels.filter(l => l.visible);
  }

  static getLevelsSortedByOrder(levels: Level[]): Level[] {
    return [...levels].sort((a, b) => a.order - b.order);
  }

  static findLevelById(levels: Level[], levelId: string): Level | null {
    return levels.find(l => l.id === levelId) || null;
  }

  static getDefaultLevel(levels: Level[]): Level | null {
    return levels.find(l => l.isDefault) || null;
  }
}

export class FloorplanOperations {
  static generateFloorplanId(): string {
    // 🏢 ADR-065: Crypto-secure, collision-resistant ID generation
    return generateFloorId();
  }

  static createFloorplan(
    levelId: string,
    fileName: string,
    name?: string
  ): Omit<FloorplanDoc, 'id' | 'importedAt'> {
    return {
      levelId,
      name: name || fileName.replace('.dxf', ''),
      fileName,
      units: 'mm',
      transform: {
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0
      },
      bbox: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } },
      calibrated: false
    };
  }

  static addFloorplan(
    floorplans: Record<string, FloorplanDoc>,
    floorplan: Omit<FloorplanDoc, 'id' | 'importedAt'>
  ): { floorplans: Record<string, FloorplanDoc>; floorplanId: string } {
    const id = FloorplanOperations.generateFloorplanId();
    const doc: FloorplanDoc = {
      ...floorplan,
      id,
      importedAt: nowISO()
    };

    return {
      floorplans: { ...floorplans, [id]: doc },
      floorplanId: id
    };
  }

  static removeFloorplan(
    floorplans: Record<string, FloorplanDoc>,
    floorplanId: string
  ): Record<string, FloorplanDoc> {
    const { [floorplanId]: removed, ...rest } = floorplans;
    return rest;
  }

  static removeFloorplansForLevel(
    floorplans: Record<string, FloorplanDoc>,
    levelId: string
  ): Record<string, FloorplanDoc> {
    const updated = { ...floorplans };
    Object.values(floorplans).forEach(fp => {
      if (fp.levelId === levelId) {
        delete updated[fp.id];
      }
    });
    return updated;
  }

  static getFloorplansForLevel(
    floorplans: Record<string, FloorplanDoc>,
    levelId: string
  ): FloorplanDoc[] {
    return Object.values(floorplans).filter(fp => fp.levelId === levelId);
  }

  static updateFloorplanTransform(
    floorplans: Record<string, FloorplanDoc>,
    floorplanId: string,
    transform: Partial<FloorplanDoc['transform']>
  ): Record<string, FloorplanDoc> {
    const floorplan = floorplans[floorplanId];
    if (!floorplan) return floorplans;

    return {
      ...floorplans,
      [floorplanId]: {
        ...floorplan,
        transform: { ...floorplan.transform, ...transform }
      }
    };
  }
}

export class CalibrationOperations {
  static calculateScale(calibration: CalibrationData): { scaleX: number; scaleY: number } {
    const screenDistance = Math.sqrt(
      Math.pow(calibration.point2.screen.x - calibration.point1.screen.x, 2) +
      Math.pow(calibration.point2.screen.y - calibration.point1.screen.y, 2)
    );
    
    const scale = calibration.realDistance / screenDistance;
    return { scaleX: scale, scaleY: scale };
  }

  static convertUnits(value: number, fromUnit: string, toUnit: string): number {
    const mmConversions: Record<string, number> = {
      'mm': 1,
      'cm': 10,
      'm': 1000,
      'in': 25.4,
      'ft': 304.8
    };

    const mmValue = value * mmConversions[fromUnit];
    return mmValue / mmConversions[toUnit];
  }

  static applyCalibrationToTransform(
    transform: FloorplanDoc['transform'],
    calibration: CalibrationData
  ): FloorplanDoc['transform'] {
    const { scaleX, scaleY } = CalibrationOperations.calculateScale(calibration);
    
    return {
      ...transform,
      scaleX: transform.scaleX * scaleX,
      scaleY: transform.scaleY * scaleY
    };
  }
}
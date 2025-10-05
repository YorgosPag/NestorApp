/**
 * LEVELS SYSTEM - Utilities
 * Level and floorplan operations and helper functions
 */

import type { Level, FloorplanDoc, CalibrationData } from './config';

export class LevelOperations {
  static createDefaultLevels(): Level[] {
    return [
      { id: 'ground', name: 'Ισόγειο', order: 0, isDefault: true, visible: true },
      { id: 'first', name: '1ος Όροφος', order: 1, isDefault: false, visible: true },
    ];
  }

  static validateLevelName(name: string, existingLevels: Level[]): string | null {
    if (!name.trim()) {
      return 'Το όνομα του επιπέδου δεν μπορεί να είναι κενό';
    }
    
    if (existingLevels.some(l => l.name.toLowerCase() === name.toLowerCase())) {
      return 'Υπάρχει ήδη επίπεδο με αυτό το όνομα';
    }
    
    return null;
  }

  static generateLevelId(): string {
    return `level_${Date.now()}`;
  }

  static getNextOrder(levels: Level[]): number {
    return Math.max(...levels.map(l => l.order), -1) + 1;
  }

  static addLevel(
    levels: Level[],
    name: string,
    setAsDefault = false
  ): { levels: Level[]; newLevelId: string } {
    const id = LevelOperations.generateLevelId();
    const order = LevelOperations.getNextOrder(levels);
    
    const newLevel: Level = {
      id,
      name,
      order,
      isDefault: setAsDefault,
      visible: true
    };

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
    return `floorplan_${Date.now()}`;
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
      importedAt: new Date().toISOString()
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
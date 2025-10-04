import { useCallback } from 'react';
import type { Point2D as Point } from '../../types/scene';
import type { TestEntityManagement } from './types';

export interface TestEntityHook {
  testEntity: TestEntityManagement;
}

export function useTestEntity(
  worldPos: Point | null,
  onInjectTestEntity?: (entity: any) => void,
  onEntityInjected?: () => void
): TestEntityHook {

  const injectTestEntity = useCallback(() => {
    if (!worldPos || !onInjectTestEntity) {
      alert('Cannot inject test entity: world position or callback is missing.');
      return;
    }
    
    const testEntity = {
      id: 'calib_test_line_' + Date.now(),
      type: 'line',
      layer: 'CALIBRATION',
      visible: true,
      start: { x: worldPos.x - 20, y: worldPos.y },
      end: { x: worldPos.x + 20, y: worldPos.y }
    };
    
    onInjectTestEntity(testEntity);
    onEntityInjected?.();
    alert('Test line created.');
  }, [worldPos, onInjectTestEntity, onEntityInjected]);

  const canInjectEntity = Boolean(worldPos && onInjectTestEntity);

  const testEntity: TestEntityManagement = {
    injectTestEntity,
    canInjectEntity,
  };

  return {
    testEntity,
  };
}
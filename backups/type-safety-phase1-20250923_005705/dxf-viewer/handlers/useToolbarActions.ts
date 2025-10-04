import { commandStore } from '../systems/levels';
import { snapSystem } from '../snapping/pro-snap-engine';
import { measurementTools as measurementTool } from '../utils/measurement-tools';
import { ViewState } from '../hooks/useViewState';
import { DXFEntity, Layer, Measurement } from '../types';

interface UseToolbarActionsProps {
  entities: DXFEntity[];
  layers: Layer[];
  measurements: Measurement[];
  viewState: ViewState;
  selectedEntityIds: string[];
  showGrid: boolean;
  showLayers: boolean;
  snapEnabled: boolean;
  setEntities: (entities: DXFEntity[]) => void;
  setSelectedEntityIds: (ids: string[]) => void;
  setMeasurements: (measurements: Measurement[]) => void;
  updateViewState: (updates: Partial<ViewState>) => void;
  setShowGrid: (show: boolean) => void;
  setShowLayers: (show: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  resetView: () => void;
}

export const useToolbarActions = ({
  entities,
  layers,
  measurements,
  viewState,
  selectedEntityIds,
  showGrid,
  showLayers,
  snapEnabled,
  setEntities,
  setSelectedEntityIds,
  setMeasurements,
  updateViewState,
  setShowGrid,
  setShowLayers,
  setSnapEnabled,
  zoomIn,
  zoomOut,
  setZoom,
  resetView
}: UseToolbarActionsProps) => {

  const handleAction = (action: string, data?: any) => {
    console.log(`🎯 Action: ${action}`, data);
    
    switch (action) {
      case 'grid':
        setShowGrid(!showGrid);
        break;
        
      case 'autocrop':
        updateViewState({ autoCrop: !viewState.autoCrop });
        break;
        
      case 'toggle-snap':
        setSnapEnabled(!snapEnabled);
        snapSystem.setSnapSettings({ enabled: !snapEnabled });
        break;
        
      case 'toggle-layers':
        setShowLayers(!showLayers);
        break;
        
      case 'layering':
        // Always show layers panel when layering tool is activated
        setShowLayers(true);
        break;
        
      case 'grip-edit':
        // Ενεργοποίηση του grip editing mode - ανοίγουμε τα layers
        console.log('🎯 [useToolbarActions] Grip Edit action');
        setShowLayers(true);
        break;
        
        
      case 'fit':
        resetView();
        break;
        
      case 'zoom-in-action':
        zoomIn();
        break;
        
      case 'zoom-out-action':
        zoomOut();
        break;
        
      case 'set-zoom':
        if (typeof data === 'number' && data > 0) {
          setZoom(data);
        }
        break;
        
      case 'undo': {
        const newState = commandStore.undo({ entities, measurements });
        if (newState) {
          setEntities(newState.entities);
          setMeasurements(newState.measurements);
        }
        break;
      }
        
      case 'redo': {
        const newState = commandStore.redo({ entities, measurements });
        if (newState) {
            setEntities(newState.entities);
            setMeasurements(newState.measurements);
        }
        break;
      }
        
      case 'select-all':
        const allIds = entities.map(e => e.id);
        setSelectedEntityIds(allIds);
        setEntities(entities.map(e => ({ ...e, selected: true })));
        break;
        
      case 'clear-selection':
        setSelectedEntityIds([]);
        setEntities(entities.map(e => ({ ...e, selected: false })));
        break;
        
      case 'export':
        exportData();
        break;
        
      default:
        console.log(`Unhandled action: ${action}`);
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify({
      entities,
      layers,
      measurements,
      viewState,
      snapSettings: snapSystem.getSnapSettings(),
      exportDate: new Date().toISOString()
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dxf-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    console.log('Export completed');
  };

  return { handleAction };
};

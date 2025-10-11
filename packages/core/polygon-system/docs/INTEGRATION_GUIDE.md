# 🔗 Universal Polygon System - Integration Guide

## 📋 Overview

Αυτός ο οδηγός δείχνει πώς να ενσωματώσετε το Universal Polygon System στις εφαρμογές σας. Υποστηρίζονται διάφορα levels integration από απλή χρήση έως πλήρη customization.

## 🚀 Quick Start

### 1. Basic React Integration

```typescript
import { usePolygonSystem } from '@/core/polygon-system';

function MyPolygonApp() {
  const {
    polygons,
    startDrawing,
    finishDrawing,
    exportAsGeoJSON
  } = usePolygonSystem({
    defaultMode: 'simple',
    autoSave: true
  });

  return (
    <div>
      <button onClick={() => startDrawing('simple')}>
        Start Drawing
      </button>
      <button onClick={finishDrawing}>
        Finish
      </button>
      <div>Polygons: {polygons.length}</div>
    </div>
  );
}
```

### 2. Canvas-based Drawing

```typescript
import { SimplePolygonDrawer } from '@/core/polygon-system';

function CanvasDrawing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawer, setDrawer] = useState<SimplePolygonDrawer | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const newDrawer = new SimplePolygonDrawer(canvasRef.current);
      setDrawer(newDrawer);
    }
  }, []);

  const startDrawing = () => {
    drawer?.startDrawing('simple');
  };

  return (
    <div>
      <canvas ref={canvasRef} width={800} height={600} />
      <button onClick={startDrawing}>Start Drawing</button>
    </div>
  );
}
```

## 🗺️ Map Integration

### MapLibre GL JS Integration

```typescript
import { InteractiveMap } from '@/subapps/geo-canvas/components/InteractiveMap';

function MapWithPolygons() {
  const [enableDrawing, setEnableDrawing] = useState(false);
  const [polygons, setPolygons] = useState<UniversalPolygon[]>([]);

  const handlePolygonCreated = (polygon: UniversalPolygon) => {
    setPolygons(prev => [...prev, polygon]);
    console.log('New polygon:', polygon);
  };

  return (
    <InteractiveMap
      transformState={mockTransformState}

      // ✅ Enable polygon system
      enablePolygonDrawing={enableDrawing}
      defaultPolygonMode="simple"
      onPolygonCreated={handlePolygonCreated}
      onPolygonModified={(polygon) => {
        setPolygons(prev => prev.map(p =>
          p.id === polygon.id ? polygon : p
        ));
      }}
      onPolygonDeleted={(id) => {
        setPolygons(prev => prev.filter(p => p.id !== id));
      }}

      className="w-full h-full"
    />
  );
}
```

### Custom Map Integration

```typescript
import { GeoCanvasPolygonManager } from '@/core/polygon-system';

function CustomMapIntegration() {
  const mapRef = useRef<any>(null);
  const [manager, setManager] = useState<GeoCanvasPolygonManager | null>(null);

  useEffect(() => {
    if (mapRef.current) {
      const polygonManager = new GeoCanvasPolygonManager({
        map: mapRef.current.getMap(),
        defaultMode: 'alert-zone',
        autoSave: true,
        callbacks: {
          onPolygonCreated: (polygon) => {
            console.log('Polygon created:', polygon);
            // Add to map layers
            polygonManager.addPolygonToMap(polygon);
          }
        }
      });

      setManager(polygonManager);
    }
  }, []);

  return (
    <div>
      <Map ref={mapRef} /* MapLibre props */ />
      <div>
        <button onClick={() => manager?.startDrawing('alert-zone')}>
          Draw Alert Zone
        </button>
      </div>
    </div>
  );
}
```

## 🎯 Specialized Use Cases

### 1. Georeferencing System

```typescript
import { ControlPointDrawer } from '@/core/polygon-system';

function GeoreferencingInterface() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawer, setDrawer] = useState<ControlPointDrawer | null>(null);
  const [controlPoints, setControlPoints] = useState<any[]>([]);

  useEffect(() => {
    if (canvasRef.current) {
      const controlDrawer = new ControlPointDrawer(canvasRef.current);
      setDrawer(controlDrawer);
    }
  }, []);

  const addControlPoint = (x: number, y: number) => {
    // Get geographic coordinates από user input
    const geoCoords = { lng: 23.7275, lat: 37.9755 }; // Example

    const point = drawer?.addControlPoint(x, y, geoCoords, `CP${controlPoints.length + 1}`);

    if (point) {
      setControlPoints(prev => [...prev, point]);
    }
  };

  const validateTransformation = () => {
    const validation = drawer?.validateForTransformation();
    console.log('Validation result:', validation);

    if (validation?.isValid) {
      const exportData = drawer?.exportForTransformation();
      console.log('Ready for transformation:', exportData);
    }
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          addControlPoint(x, y);
        }}
      />

      <div>
        <p>Control Points: {controlPoints.length}</p>
        <button onClick={validateTransformation}>
          Validate Transformation
        </button>
      </div>
    </div>
  );
}
```

### 2. Alert Zone Management

```typescript
function AlertZoneManager() {
  const {
    polygons,
    setMode,
    startDrawing,
    finishDrawing,
    deletePolygon
  } = usePolygonSystem({
    defaultMode: 'alert-zone',
    autoSave: true,
    storageKey: 'alert-zones'
  });

  const alertZones = polygons.filter(p => p.type === 'alert-zone');

  const createNewAlertZone = () => {
    setMode('alert-zone');
    startDrawing('alert-zone', {
      strokeColor: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.2
    });
  };

  const exportAlertZones = () => {
    const geojson = {
      type: 'FeatureCollection' as const,
      features: alertZones.map(zone => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[/* coordinates από zone.points */]]
        },
        properties: {
          id: zone.id,
          type: 'alert-zone',
          createdAt: zone.metadata?.createdAt,
          area: zone.metadata?.area
        }
      }))
    };

    // Download ως αρχείο
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alert-zones.geojson';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="controls">
        <button onClick={createNewAlertZone}>
          Create Alert Zone
        </button>
        <button onClick={finishDrawing}>
          Finish Drawing
        </button>
        <button onClick={exportAlertZones}>
          Export Alert Zones
        </button>
      </div>

      <div className="alert-zones">
        <h3>Alert Zones ({alertZones.length})</h3>
        {alertZones.map(zone => (
          <div key={zone.id} className="alert-zone-item">
            <span>{zone.id}</span>
            <span>{zone.points.length} points</span>
            <button onClick={() => deletePolygon(zone.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 🎨 Custom Styling

### Dynamic Styling

```typescript
function CustomStyledPolygons() {
  const polygonSystem = usePolygonSystem();

  const createStyledPolygon = (type: PolygonType) => {
    const styles = {
      'simple': {
        strokeColor: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2
      },
      'alert-zone': {
        strokeColor: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.3,
        strokeWidth: 3
      },
      'measurement': {
        strokeColor: '#10b981',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeDash: [5, 5]
      }
    };

    polygonSystem.startDrawing(type, styles[type]);
  };

  return (
    <div>
      {(['simple', 'alert-zone', 'measurement'] as PolygonType[]).map(type => (
        <button key={type} onClick={() => createStyledPolygon(type)}>
          Draw {type}
        </button>
      ))}
    </div>
  );
}
```

### Theme-based Styling

```typescript
const THEMES = {
  light: {
    simple: { strokeColor: '#1f2937', fillColor: '#3b82f6' },
    'alert-zone': { strokeColor: '#dc2626', fillColor: '#ef4444' }
  },
  dark: {
    simple: { strokeColor: '#f9fafb', fillColor: '#60a5fa' },
    'alert-zone': { strokeColor: '#fca5a5', fillColor: '#f87171' }
  }
};

function ThemedPolygons({ theme }: { theme: 'light' | 'dark' }) {
  const polygonSystem = usePolygonSystem();

  const drawWithTheme = (type: PolygonType) => {
    const style = THEMES[theme][type];
    polygonSystem.startDrawing(type, style);
  };

  // ... render logic
}
```

## 📱 Mobile Integration

### Touch-optimized Drawing

```typescript
function MobilePolygonDrawer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawer, setDrawer] = useState<SimplePolygonDrawer | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const mobileDrawer = new SimplePolygonDrawer(canvasRef.current);

      // Customize για mobile
      mobileDrawer.setOptions({
        snapTolerance: 20, // Larger tolerance για fingers
        style: {
          ...mobileDrawer.getState().style,
          pointRadius: 8, // Larger points για touch
          strokeWidth: 3  // Thicker lines
        }
      });

      setDrawer(mobileDrawer);
    }
  }, []);

  // Touch event handling
  const handleTouch = (e: React.TouchEvent) => {
    e.preventDefault();

    if (!drawer || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    drawer.addPoint(x, y);
  };

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight * 0.8}
      onTouchStart={handleTouch}
      style={{ touchAction: 'none' }}
    />
  );
}
```

## 🔄 Data Persistence

### Local Storage Integration

```typescript
function PersistentPolygonSystem() {
  const {
    polygons,
    exportAsGeoJSON,
    importFromGeoJSON
  } = usePolygonSystem({
    autoSave: true,
    storageKey: 'my-polygons'
  });

  // Manual save/load
  const saveToFile = () => {
    const data = exportAsGeoJSON();
    localStorage.setItem('polygon-backup', JSON.stringify(data));
  };

  const loadFromFile = () => {
    const stored = localStorage.getItem('polygon-backup');
    if (stored) {
      const data = JSON.parse(stored);
      importFromGeoJSON(data);
    }
  };

  return (
    <div>
      <button onClick={saveToFile}>Save to File</button>
      <button onClick={loadFromFile}>Load from File</button>
      <p>Auto-saved polygons: {polygons.length}</p>
    </div>
  );
}
```

### Database Integration

```typescript
// API integration example
async function savePolygonToDatabase(polygon: UniversalPolygon) {
  const response = await fetch('/api/polygons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: polygon.id,
      type: polygon.type,
      geometry: {
        type: 'Polygon',
        coordinates: [polygon.points.map(p => [p.x, p.y])]
      },
      properties: {
        style: polygon.style,
        metadata: polygon.metadata
      }
    })
  });

  return response.json();
}

function DatabaseIntegratedPolygons() {
  const polygonSystem = usePolygonSystem({
    callbacks: {
      onPolygonCreated: async (polygon) => {
        try {
          await savePolygonToDatabase(polygon);
          console.log('Polygon saved to database');
        } catch (error) {
          console.error('Failed to save polygon:', error);
        }
      }
    }
  });

  // ... component logic
}
```

## 🧪 Testing Integration

### Unit Testing

```typescript
import { validatePolygon, calculatePolygonArea } from '@/core/polygon-system';

describe('Polygon System', () => {
  test('validates polygon correctly', () => {
    const validPolygon: UniversalPolygon = {
      id: 'test-1',
      type: 'simple',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ],
      isClosed: true,
      style: { /* style config */ }
    };

    const result = validatePolygon(validPolygon);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('calculates area correctly', () => {
    const area = calculatePolygonArea(validPolygon);
    expect(area).toBe(100); // 10x10 square
  });
});
```

### Integration Testing

```typescript
import { render, fireEvent } from '@testing-library/react';
import { usePolygonSystem } from '@/core/polygon-system';

function TestComponent() {
  const { startDrawing, finishDrawing, polygons } = usePolygonSystem();

  return (
    <div>
      <button onClick={() => startDrawing('simple')}>Start</button>
      <button onClick={finishDrawing}>Finish</button>
      <div data-testid="polygon-count">{polygons.length}</div>
    </div>
  );
}

test('polygon system workflow', () => {
  const { getByText, getByTestId } = render(<TestComponent />);

  fireEvent.click(getByText('Start'));
  fireEvent.click(getByText('Finish'));

  expect(getByTestId('polygon-count')).toHaveTextContent('1');
});
```

## 🔧 Advanced Configuration

### Custom Drawing Modes

```typescript
// Extend polygon types
type ExtendedPolygonType = PolygonType | 'custom-boundary' | 'exclusion-zone';

const CUSTOM_STYLES: Record<ExtendedPolygonType, PolygonStyle> = {
  ...DEFAULT_POLYGON_STYLES,
  'custom-boundary': {
    strokeColor: '#8b5cf6',
    fillColor: '#8b5cf6',
    fillOpacity: 0.1,
    strokeWidth: 3,
    strokeDash: [10, 5]
  },
  'exclusion-zone': {
    strokeColor: '#f59e0b',
    fillColor: '#f59e0b',
    fillOpacity: 0.15,
    strokeWidth: 2
  }
};

function CustomPolygonModes() {
  const polygonSystem = usePolygonSystem();

  const drawCustomBoundary = () => {
    polygonSystem.startDrawing(
      'custom-boundary' as PolygonType,
      CUSTOM_STYLES['custom-boundary']
    );
  };

  // ... implementation
}
```

### Performance Optimization

```typescript
// Optimize για large numbers of polygons
function OptimizedPolygonRenderer({ polygons }: { polygons: UniversalPolygon[] }) {
  const [visiblePolygons, setVisiblePolygons] = useState<UniversalPolygon[]>([]);
  const [viewport, setViewport] = useState({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 });

  useEffect(() => {
    // Spatial filtering για performance
    const visible = polygons.filter(polygon => {
      const bounds = getPolygonBounds(polygon);
      return (
        bounds.maxX >= viewport.minX &&
        bounds.minX <= viewport.maxX &&
        bounds.maxY >= viewport.minY &&
        bounds.minY <= viewport.maxY
      );
    });

    setVisiblePolygons(visible);
  }, [polygons, viewport]);

  // Render μόνο visible polygons
  return (
    <div>
      {visiblePolygons.map(polygon => (
        <PolygonComponent key={polygon.id} polygon={polygon} />
      ))}
    </div>
  );
}
```

## 🚨 Error Handling

### Robust Error Handling

```typescript
function RobustPolygonSystem() {
  const [error, setError] = useState<string | null>(null);

  const polygonSystem = usePolygonSystem({
    callbacks: {
      onPolygonCreated: (polygon) => {
        try {
          const validation = validatePolygon(polygon);
          if (!validation.isValid) {
            setError(`Invalid polygon: ${validation.errors.join(', ')}`);
            return;
          }

          // Process valid polygon
          setError(null);
        } catch (err) {
          setError(`Failed to process polygon: ${err.message}`);
        }
      }
    }
  });

  return (
    <div>
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Polygon interface */}
    </div>
  );
}
```

---

## 📚 Next Steps

1. **Review Examples**: Check το `examples/` directory για complete implementations
2. **API Reference**: Δείτε το [API_REFERENCE.md](./API_REFERENCE.md) για detailed API docs
3. **Migration Guide**: Αν migrating από άλλο system, δείτε [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
4. **Performance Guide**: Για optimization tips, δείτε [PERFORMANCE.md](./PERFORMANCE.md)

---

*🔗 Complete Integration Guide | 🏢 Enterprise Ready | 🎯 Production Tested*
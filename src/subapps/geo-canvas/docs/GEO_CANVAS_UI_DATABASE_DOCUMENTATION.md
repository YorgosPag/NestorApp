# 🎨 GEO-CANVAS UI & DATABASE DOCUMENTATION

**User Interface Components, Database Schema & Data Management**

---

## 📋 ΠΕΡΙΕΧΟΜΕΝΑ

1. [🎨 User Interface Components](#ui-components)
2. [📊 Database Schema & Management](#database-schema)
3. [🔒 Security & Performance Systems](#security-performance)
4. [🧪 Testing & Quality Assurance](#testing-quality)

---

## 🎨 USER INTERFACE COMPONENTS {#ui-components}

### 1. **Core Application Components**

#### **GeoreferencingPanel.tsx** - DXF Georeferencing Interface

**📁 Location**: `src/subapps/geo-canvas/components/GeoreferencingPanel.tsx`
**📊 Size**: 420+ lines
**🎯 Purpose**: Enterprise UI για DXF georeferencing workflow

##### Τι κάνει:
```typescript
export function GeoreferencingPanel() {
  const [transformState, transformActions] = useGeoTransform();

  // 🎯 Control Point Management
  const handleAddPoint = async () => {
    const dxfPoint: DxfCoordinate = {
      x: parseFloat(newPointData.dxfX),
      y: parseFloat(newPointData.dxfY)
    };

    const geoPoint: GeoCoordinate = {
      lng: parseFloat(newPointData.geoLng),
      lat: parseFloat(newPointData.geoLat)
    };

    await transformActions.addControlPoint(dxfPoint, geoPoint, {
      accuracy: parseFloat(newPointData.accuracy),
      description: newPointData.description
    });
  };
}
```

##### **Key Features**:
- **Control Point Entry**: Manual coordinate entry με validation
- **Visual Feedback**: Real-time accuracy assessment
- **Batch Operations**: Multiple control point management
- **Export/Import**: Control point data persistence

---

#### **CoordinatePicker.tsx** - Interactive Coordinate Selection

**📁 Location**: `src/subapps/geo-canvas/components/CoordinatePicker.tsx`
**📊 Size**: 380+ lines
**🎯 Purpose**: Interactive coordinate selection tool

##### Τι κάνει:
```typescript
export function CoordinatePicker({
  onCoordinateSelect,
  coordinateSystem = 'EPSG:4326',
  showPreview = true
}) {
  // 🎯 Visual coordinate picking
  const handleMapClick = (event: MapMouseEvent) => {
    const coords = event.lngLat;
    onCoordinateSelect({
      lng: coords.lng,
      lat: coords.lat,
      accuracy: calculateClickAccuracy(event)
    });
  };
}
```

##### **Features**:
- **Interactive Map Selection**: Click-to-select coordinates
- **Multiple CRS Support**: Coordinate system conversion
- **Accuracy Visualization**: Visual accuracy indicators
- **Crosshair Tool**: Precision targeting για accurate selection

---

#### **InteractiveMap.tsx** - MapLibre GL JS Integration

**📁 Location**: `src/subapps/geo-canvas/components/InteractiveMap.tsx`
**📊 Size**: 650+ lines
**🎯 Purpose**: Enterprise MapLibre GL JS wrapper με advanced functionality

##### Τι κάνει:
```typescript
export function InteractiveMap({
  style = 'satellite',
  center = [23.7275, 37.9838], // Athens, Greece
  zoom = 7,
  onMapLoad,
  onMapClick,
  layers = [],
  controls = true
}) {
  // 🗺️ Map initialization με performance optimization
  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(style),
      center: center,
      zoom: zoom,
      attributionControl: false
    });

    // 🎨 Add custom layers
    layers.forEach(layer => {
      map.addLayer(layer);
    });
  }, []);
}
```

##### **Advanced Features**:
- **Custom Layer Support**: GeoJSON, raster, vector layers
- **Real-time Updates**: WebSocket integration για live data
- **Performance Optimization**: Clustering, simplification, caching
- **Touch Support**: Mobile-optimized touch controls

---

### 2. **Design System Components**

#### **ResponsiveDashboard.tsx** - Enterprise Layout System

**📁 Location**: `src/subapps/geo-canvas/ui/design-system/layout/ResponsiveDashboard.tsx`
**📊 Size**: 780+ lines
**🎯 Purpose**: Advanced responsive dashboard με adaptive layout

##### Τι κάνει:
```typescript
export function ResponsiveDashboard({
  children,
  header,
  sidebar,
  footer,
  sidebarCollapsible = true,
  sidebarDefaultCollapsed = false
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(sidebarDefaultCollapsed);
  const breakpoint = useBreakpoint();

  // 📱 Adaptive layout based on screen size
  const layoutConfig = useMemo(() => ({
    sidebarWidth: sidebarCollapsed ? 60 : 280,
    contentPadding: breakpoint === 'mobile' ? 16 : 24,
    headerHeight: 64,
    footerHeight: 48
  }), [sidebarCollapsed, breakpoint]);
}
```

##### **Layout Features**:
- **Adaptive Responsive Design**: Mobile-first approach
- **Collapsible Sidebar**: Space-efficient layout
- **Grid System**: Flexible 12-column grid με breakpoints
- **Component Composition**: Reusable layout primitives

##### **Grid System**:
```typescript
// 📊 Responsive grid με breakpoint support
<Grid columns={{ xs: 1, md: 2, lg: 3, xl: 4 }} gap={4}>
  <GridItem span={{ xs: 1, md: 2 }}>
    <AnalyticsCard />
  </GridItem>
  <GridItem span={1}>
    <StatusWidget />
  </GridItem>
</Grid>
```

---

#### **AdvancedCharts.tsx** - Data Visualization Components

**📁 Location**: `src/subapps/geo-canvas/ui/design-system/charts/AdvancedCharts.tsx`
**📊 Size**: 920+ lines
**🎯 Purpose**: Enterprise data visualization με D3.js integration

##### Τι κάνει:
```typescript
export function SpatialAnalyticsChart({
  data,
  type = 'heatmap',
  interactive = true,
  realtime = false
}) {
  // 📊 D3.js visualization με React integration
  useEffect(() => {
    const svg = d3.select(chartRef.current);

    // 🎨 Create visualization based on type
    switch (type) {
      case 'heatmap':
        renderHeatmap(svg, data);
        break;
      case 'trajectory':
        renderTrajectory(svg, data);
        break;
      case 'cluster':
        renderClusterAnalysis(svg, data);
        break;
    }
  }, [data, type]);
}
```

##### **Chart Types**:
- **Spatial Heatmaps**: Density visualization
- **Trajectory Analysis**: Movement pattern charts
- **Cluster Analysis**: Spatial clustering visualization
- **Real-time Dashboards**: Live data streaming charts

---

#### **ThemeProvider.tsx** - Enterprise Theme System

**📁 Location**: `src/subapps/geo-canvas/ui/design-system/theme/ThemeProvider.tsx`
**📊 Size**: 450+ lines
**🎯 Purpose**: Enterprise theme system με dark/light mode support

##### Τι κάνει:
```typescript
export function ThemeProvider({ children, defaultTheme = 'light' }) {
  const [theme, setTheme] = useState(defaultTheme);
  const [breakpoint, setBreakpoint] = useState('desktop');

  // 🎨 Theme context με design tokens
  const themeContext = useMemo(() => ({
    theme,
    setTheme,
    breakpoint,
    colors: designTokens.colors[theme],
    typography: designTokens.typography,
    spacing: designTokens.spacing,
    shadows: designTokens.shadows[theme]
  }), [theme, breakpoint]);
}
```

##### **Design Tokens**:
```typescript
export const designTokens = {
  colors: {
    light: {
      primary: '#2563EB',      // Blue 600
      secondary: '#64748B',    // Slate 500
      success: '#059669',      // Emerald 600
      warning: '#D97706',      // Amber 600
      error: '#DC2626',        // Red 600
      background: '#FFFFFF',   // White
      surface: '#F8FAFC',      // Slate 50
      text: '#0F172A'          // Slate 900
    },
    dark: {
      primary: '#3B82F6',      // Blue 500
      secondary: '#94A3B8',    // Slate 400
      success: '#10B981',      // Emerald 500
      warning: '#F59E0B',      // Amber 500
      error: '#EF4444',        // Red 500
      background: '#0F172A',   // Slate 900
      surface: '#1E293B',      // Slate 800
      text: '#F1F5F9'          // Slate 100
    }
  }
};
```

---

### 3. **Performance Components**

#### **PerformanceComponents.tsx** - Optimized UI Components

**📁 Location**: `src/subapps/geo-canvas/ui/design-system/performance/PerformanceComponents.tsx`
**📊 Size**: 540+ lines
**🎯 Purpose**: Performance-optimized React components

##### Τι κάνει:
```typescript
// 🚀 Virtualized list για large datasets
export const VirtualizedSpatialList = memo(({
  items,
  itemHeight = 60,
  overscan = 5
}) => {
  const [startIndex, endIndex] = useVirtualization({
    itemCount: items.length,
    itemHeight,
    containerHeight,
    overscan
  });

  const visibleItems = items.slice(startIndex, endIndex);
});

// 📊 Memoized chart component
export const OptimizedChart = memo(({
  data,
  config
}) => {
  const memoizedData = useMemo(() =>
    processChartData(data), [data]
  );

  return <Chart data={memoizedData} config={config} />;
});
```

---

## 📊 DATABASE SCHEMA & MANAGEMENT {#database-schema}

### 1. **PostGIS Database Schema**

**📁 Location**: `src/subapps/geo-canvas/database/schema/postgis-schema.sql`
**📊 Size**: 680+ lines
**🎯 Purpose**: Complete PostGIS database schema για spatial data management

#### **Core Tables**:

##### **🗺️ Projects Table**:
```sql
CREATE TABLE geo_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    crs VARCHAR(50) NOT NULL DEFAULT 'EPSG:4326',
    bounds GEOMETRY(POLYGON, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 📍 Spatial index για performance
CREATE INDEX idx_geo_projects_bounds
ON geo_projects USING GIST (bounds);
```

##### **🎯 Control Points Table**:
```sql
CREATE TABLE control_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES geo_projects(id) ON DELETE CASCADE,
    dxf_coordinate GEOMETRY(POINT, 0),      -- DXF coordinate system
    geo_coordinate GEOMETRY(POINT, 4326),   -- Geographic coordinate
    accuracy DECIMAL(10, 3) DEFAULT 1.0,   -- Accuracy in meters
    confidence DECIMAL(3, 2) DEFAULT 1.0,  -- Confidence score 0-1
    source control_point_source DEFAULT 'manual',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 🚀 Performance indexes
CREATE INDEX idx_control_points_project
ON control_points (project_id);
CREATE INDEX idx_control_points_geo
ON control_points USING GIST (geo_coordinate);
```

##### **🚨 Alert Rules Table**:
```sql
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES geo_projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    geometry GEOMETRY(GEOMETRY, 4326),      -- Alert boundary
    rule_type alert_rule_type NOT NULL,
    trigger_conditions JSONB NOT NULL,
    action_config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority alert_priority DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 📊 Spatial και performance indexes
CREATE INDEX idx_alert_rules_geometry
ON alert_rules USING GIST (geometry);
CREATE INDEX idx_alert_rules_active
ON alert_rules (is_active) WHERE is_active = true;
```

#### **Custom Types**:
```sql
-- 🎯 Control point sources
CREATE TYPE control_point_source AS ENUM (
    'manual',      -- Manually entered
    'gps',         -- GPS survey
    'survey',      -- Professional survey
    'automatic'    -- Auto-detected
);

-- 🚨 Alert rule types
CREATE TYPE alert_rule_type AS ENUM (
    'boundary',     -- Boundary crossing
    'proximity',    -- Distance-based
    'temporal',     -- Time-based
    'conditional'   -- Complex conditions
);

-- ⚡ Alert priorities
CREATE TYPE alert_priority AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);
```

---

### 2. **Database Management Services**

#### **DatabaseManager.ts** - Connection & Pool Management

**📁 Location**: `src/subapps/geo-canvas/database/connection/DatabaseManager.ts`
**📊 Size**: 480+ lines
**🎯 Purpose**: Enterprise PostgreSQL connection management

##### **Connection Pooling**:
```typescript
export class DatabaseManager {
  private pool: Pool;
  private config: DatabaseConfig;

  async initialize(config: DatabaseConfig): Promise<void> {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: config.ssl,

      // 🏊 Pool configuration
      min: config.pool.min,           // Min connections: 2
      max: config.pool.max,           // Max connections: 20
      idleTimeoutMillis: config.pool.idle,     // 30 seconds
      acquireTimeoutMillis: config.pool.acquire, // 60 seconds
      createTimeoutMillis: 20000,     // 20 seconds
      destroyTimeoutMillis: 5000,     // 5 seconds
      reapIntervalMillis: 1000        // 1 second
    });
  }

  // 🔄 Execute query με automatic retry
  async query<T>(
    sql: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retry.attempts; attempt++) {
      try {
        const client = await this.pool.connect();
        try {
          return await client.query(sql, params);
        } finally {
          client.release();
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.config.retry.attempts) {
          await this.delay(this.config.retry.delay * Math.pow(this.config.retry.factor, attempt - 1));
        }
      }
    }

    throw lastError!;
  }
}
```

---

#### **Repository Pattern Implementation**

##### **ProjectRepository.ts** - Project Data Access

**📁 Location**: `src/subapps/geo-canvas/database/repositories/ProjectRepository.ts`
**📊 Size**: 520+ lines

```typescript
export class ProjectRepository {
  constructor(private db: DatabaseManager) {}

  // ➕ Create new project
  async create(projectData: CreateProjectData): Promise<GeoProject> {
    const sql = `
      INSERT INTO geo_projects (name, description, crs, bounds, created_by, metadata)
      VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4), $5, $6)
      RETURNING id, name, description, crs,
                ST_AsGeoJSON(bounds) as bounds,
                created_at, updated_at, created_by, metadata
    `;

    const result = await this.db.query(sql, [
      projectData.name,
      projectData.description,
      projectData.crs,
      JSON.stringify(projectData.bounds),
      projectData.createdBy,
      projectData.metadata
    ]);

    return this.mapProjectFromRow(result.rows[0]);
  }

  // 🔍 Find projects με spatial filtering
  async findWithinBounds(bounds: GeoJSON.Polygon): Promise<GeoProject[]> {
    const sql = `
      SELECT id, name, description, crs,
             ST_AsGeoJSON(bounds) as bounds,
             created_at, updated_at, created_by, metadata
      FROM geo_projects
      WHERE ST_Intersects(bounds, ST_GeomFromGeoJSON($1))
      ORDER BY created_at DESC
    `;

    const result = await this.db.query(sql, [JSON.stringify(bounds)]);
    return result.rows.map(row => this.mapProjectFromRow(row));
  }
}
```

##### **ControlPointRepository.ts** - Control Point Management

**📁 Location**: `src/subapps/geo-canvas/database/repositories/ControlPointRepository.ts`
**📊 Size**: 440+ lines

```typescript
export class ControlPointRepository {
  // 🎯 Add control point με validation
  async create(pointData: CreateControlPointData): Promise<GeoControlPoint> {
    const sql = `
      INSERT INTO control_points (
        project_id, dxf_coordinate, geo_coordinate,
        accuracy, confidence, source, description, metadata
      )
      VALUES (
        $1,
        ST_Point($2, $3),
        ST_Point($4, $5, 4326),
        $6, $7, $8, $9, $10
      )
      RETURNING id, project_id,
                ST_X(dxf_coordinate) as dxf_x,
                ST_Y(dxf_coordinate) as dxf_y,
                ST_X(geo_coordinate) as geo_lng,
                ST_Y(geo_coordinate) as geo_lat,
                accuracy, confidence, source, description,
                created_at, metadata
    `;

    const result = await this.db.query(sql, [
      pointData.projectId,
      pointData.dxfCoordinate.x,
      pointData.dxfCoordinate.y,
      pointData.geoCoordinate.lng,
      pointData.geoCoordinate.lat,
      pointData.accuracy,
      pointData.confidence,
      pointData.source,
      pointData.description,
      pointData.metadata
    ]);

    return this.mapControlPointFromRow(result.rows[0]);
  }

  // 📊 Calculate transformation statistics
  async getTransformationStats(projectId: string): Promise<TransformationStats> {
    const sql = `
      SELECT
        COUNT(*) as total_points,
        AVG(accuracy) as avg_accuracy,
        MIN(accuracy) as min_accuracy,
        MAX(accuracy) as max_accuracy,
        STDDEV(accuracy) as accuracy_stddev,
        AVG(confidence) as avg_confidence
      FROM control_points
      WHERE project_id = $1
    `;

    const result = await this.db.query(sql, [projectId]);
    return result.rows[0];
  }
}
```

---

### 3. **Data Migration Service**

**📁 Location**: `src/subapps/geo-canvas/database/migration/DataMigrationService.ts`
**📊 Size**: 350+ lines
**🎯 Purpose**: Database schema migration και data versioning

```typescript
export class DataMigrationService {
  // 🔄 Run database migrations
  async runMigrations(): Promise<MigrationResult> {
    const migrations = await this.getPendingMigrations();
    const results: MigrationResult[] = [];

    for (const migration of migrations) {
      try {
        await this.runMigration(migration);
        await this.recordMigration(migration);
        results.push({ migration: migration.name, status: 'success' });
      } catch (error) {
        results.push({
          migration: migration.name,
          status: 'failed',
          error: error.message
        });
        break; // Stop on first failure
      }
    }

    return { results, totalMigrations: migrations.length };
  }

  // 📊 Database health check
  async healthCheck(): Promise<DatabaseHealth> {
    const checks = await Promise.allSettled([
      this.checkConnection(),
      this.checkPostGISExtension(),
      this.checkTableExists('geo_projects'),
      this.checkIndexes(),
      this.checkDiskSpace()
    ]);

    return {
      status: checks.every(check => check.status === 'fulfilled') ? 'healthy' : 'degraded',
      checks: checks.map((check, index) => ({
        name: ['connection', 'postgis', 'tables', 'indexes', 'disk'][index],
        status: check.status,
        message: check.status === 'rejected' ? check.reason.message : 'OK'
      }))
    };
  }
}
```

---

*Συνεχίζεται στο επόμενο τμήμα με Security, Performance & Deployment Systems...*
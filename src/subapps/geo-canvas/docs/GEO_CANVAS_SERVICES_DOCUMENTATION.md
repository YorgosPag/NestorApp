# 🔄 GEO-CANVAS SERVICES - BUSINESS LOGIC DOCUMENTATION

**Enterprise Business Logic Layer - Services & Transformation Engines**

---

## 📋 ΠΕΡΙΕΧΟΜΕΝΑ SERVICES

1. [🗺️ Geo-Transform Services](#geo-transform-services)
2. [🚨 Alert Engine Services](#alert-engine-services)
3. [📊 Database Services](#database-services)
4. [🔄 Integration Services](#integration-services)

---

## 🗺️ GEO-TRANSFORM SERVICES {#geo-transform-services}

### 1. **DxfGeoTransform.ts** - Κεντρικός Transformation Engine

**📁 Location**: `src/subapps/geo-canvas/services/geo-transform/DxfGeoTransform.ts`
**📊 Size**: 680+ lines
**🎯 Purpose**: Enterprise-class transformation engine για μετατροπή DXF coordinates σε geographic coordinates

#### Τι κάνει:

##### **🔧 Core Transformation Methods**:
```typescript
export class DxfGeoTransformService {
  // 🎯 Calibration από control points
  async calibrateTransformation(
    controlPoints: GeoControlPoint[],
    method: 'affine' | 'polynomial' | 'tps' = 'affine'
  ): Promise<GeoreferenceInfo>

  // 🌍 DXF → Geographic coordinate conversion
  transformDxfToGeo(dxfCoord: DxfCoordinate): GeoCoordinate

  // 📐 Geographic → DXF coordinate conversion
  transformGeoToDxf(geoCoord: GeoCoordinate): DxfCoordinate

  // 📊 Batch transformation για performance
  transformBatch(coordinates: DxfCoordinate[]): GeoCoordinate[]
}
```

##### **📈 Transformation Algorithms**:

**🔹 Affine Transformation** (Default):
- **Use Case**: Uniform scaling, rotation, translation
- **Accuracy**: ±1-5 meters για τοπικά projects
- **Performance**: Fastest (O(1) transformation)
- **Formula**: `[x', y'] = [a*x + b*y + c, d*x + e*y + f]`

**🔹 Polynomial Transformation**:
- **Use Case**: Non-linear distortions, complex mappings
- **Accuracy**: ±0.5-2 meters με επαρκή control points
- **Performance**: Medium (O(n) στο βαθμό polynomial)
- **Formula**: `x' = Σ(aij * x^i * y^j)`

**🔹 Thin Plate Spline (TPS)**:
- **Use Case**: Flexible deformation, irregular distortions
- **Accuracy**: Highest (sub-meter precision)
- **Performance**: Slowest (O(n²) για n control points)
- **Formula**: Complex radial basis function

##### **🎯 Control Point Management**:
```typescript
interface GeoControlPoint {
  id: string;
  dxfCoordinate: DxfCoordinate;       // DXF position
  geoCoordinate: GeoCoordinate;       // Real-world GPS position
  accuracy: number;                   // ±meters accuracy
  confidence: number;                 // 0-1 confidence score
  source: 'manual' | 'gps' | 'survey';
  timestamp: Date;
  metadata?: {
    surveyDate?: Date;
    equipment?: string;
    surveyor?: string;
    notes?: string;
  };
}
```

##### **🔍 Quality Assessment**:
```typescript
// 📊 Transformation accuracy analysis
calculateTransformationAccuracy(
  controlPoints: GeoControlPoint[]
): TransformationAccuracy {
  return {
    rmsError: number,              // Root Mean Square error
    maxError: number,              // Maximum error found
    minError: number,              // Minimum error found
    averageError: number,          // Average error
    standardDeviation: number,     // Error distribution
    confidence: number,            // Overall confidence (0-1)
    recommendedMethod: string      // Best transformation method
  };
}
```

##### **📐 Coordinate Reference System Support**:
- **WGS84 (EPSG:4326)** - Global GPS coordinates
- **GGRS87 (EPSG:2100)** - Greek Grid Reference System
- **UTM Zone 34N (EPSG:32634)** - European UTM projection
- **Custom CRS** - User-defined coordinate systems

---

### 2. **ControlPointManager.ts** - Control Point Management System

**📁 Location**: `src/subapps/geo-canvas/services/geo-transform/ControlPointManager.ts`
**📊 Size**: 520+ lines
**🎯 Purpose**: Enterprise management system για geo-referencing control points

#### Τι κάνει:

##### **🎯 Control Point Operations**:
```typescript
export class ControlPointManager {
  // ➕ Add new control point
  async addControlPoint(
    dxfCoord: DxfCoordinate,
    geoCoord: GeoCoordinate,
    metadata?: ControlPointMetadata
  ): Promise<GeoControlPoint>

  // ✏️ Update existing control point
  async updateControlPoint(
    id: string,
    updates: Partial<GeoControlPoint>
  ): Promise<GeoControlPoint>

  // 🗑️ Remove control point
  async removeControlPoint(id: string): Promise<boolean>

  // 📊 Validate control point accuracy
  async validateControlPoint(point: GeoControlPoint): Promise<ValidationResult>
}
```

##### **🔍 Quality Control**:
```typescript
// 📈 Control point analysis
analyzeControlPoints(points: GeoControlPoint[]): ControlPointAnalysis {
  return {
    totalPoints: number,
    distribution: {
      excellent: number,    // <1m accuracy
      good: number,         // 1-3m accuracy
      fair: number,         // 3-10m accuracy
      poor: number          // >10m accuracy
    },
    coverage: {
      area: number,         // Covered area (km²)
      density: number,      // Points per km²
      uniformity: number    // Distribution uniformity (0-1)
    },
    recommendations: string[]
  };
}
```

##### **📊 Spatial Distribution Analysis**:
- **Coverage Analysis**: Ανάλυση της γεωγραφικής κάλυψης
- **Density Optimization**: Προτάσεις για optimal point placement
- **Accuracy Assessment**: Statistical analysis της ακρίβειας
- **Outlier Detection**: Εντοπισμός problematic control points

---

### 3. **AccuracyValidator.ts** - Transformation Accuracy Validation

**📁 Location**: `src/subapps/geo-canvas/utils/AccuracyValidator.ts`
**📊 Size**: 380+ lines
**🎯 Purpose**: Enterprise validation system για transformation accuracy assessment

#### Τι κάνει:

##### **🎯 Validation Methods**:
```typescript
export class AccuracyValidator {
  // 📊 Overall transformation assessment
  validateTransformation(
    transformationMatrix: GeoTransformMatrix,
    controlPoints: GeoControlPoint[],
    testPoints?: GeoControlPoint[]
  ): ValidationResult

  // 🎯 Individual point validation
  validateControlPoint(
    point: GeoControlPoint,
    expectedAccuracy: number
  ): PointValidationResult

  // 📈 Statistical accuracy analysis
  calculateStatistics(
    errors: number[]
  ): AccuracyStatistics
}
```

##### **📊 Accuracy Metrics**:
```typescript
interface AccuracyStatistics {
  rmsError: number;              // Root Mean Square Error
  mae: number;                   // Mean Absolute Error
  medianError: number;           // Median error
  percentile95: number;          // 95th percentile error
  standardDeviation: number;     // Error standard deviation
  confidenceInterval: {         // 95% confidence interval
    lower: number;
    upper: number;
  };
  outliers: number[];           // Outlier indices
  grade: 'A' | 'B' | 'C' | 'D' | 'F';  // Overall grade
}
```

##### **🏆 Quality Standards**:
- **Grade A**: RMS Error < 1m (Survey-grade accuracy)
- **Grade B**: RMS Error < 3m (Engineering-grade accuracy)
- **Grade C**: RMS Error < 10m (Mapping-grade accuracy)
- **Grade D**: RMS Error < 50m (Planning-grade accuracy)
- **Grade F**: RMS Error > 50m (Unacceptable accuracy)

---

## 🚨 ALERT ENGINE SERVICES {#alert-engine-services}

### 1. **AlertDetectionSystem.ts** - Core Alert Detection Engine

**📁 Location**: `src/subapps/geo-canvas/alert-engine/detection/AlertDetectionSystem.ts`
**📊 Size**: 850+ lines
**🎯 Purpose**: Real-time spatial alert detection και processing system

#### Τι κάνει:

##### **🔍 Detection Algorithms**:
```typescript
export class AlertDetectionSystem {
  // 🎯 Real-time spatial monitoring
  async startMonitoring(): Promise<void>

  // 🚨 Process incoming spatial events
  async processEvent(event: SpatialEvent): Promise<AlertInstance[]>

  // 📊 Evaluate alert rules against spatial data
  async evaluateRules(
    location: GeoCoordinate,
    entity?: SpatialEntity
  ): Promise<RuleEvaluationResult[]>

  // 🔄 Update alert rules
  async updateRules(rules: GeoAlertRule[]): Promise<void>
}
```

##### **📍 Spatial Detection Types**:

**🔹 Point-in-Polygon Detection**:
```typescript
// Εντοπισμός entities εντός geographic boundaries
detectPointInPolygon(
  point: GeoCoordinate,
  polygon: GeoJSON.Polygon
): boolean
```

**🔹 Proximity Detection**:
```typescript
// Εντοπισμός entities κοντά σε POIs
detectProximity(
  point: GeoCoordinate,
  targetPoint: GeoCoordinate,
  radius: number
): ProximityResult
```

**🔹 Movement Pattern Detection**:
```typescript
// Ανάλυση movement patterns και anomalies
detectMovementPattern(
  trajectory: GeoCoordinate[],
  timeStamps: Date[]
): MovementAnalysis
```

##### **⚡ Real-time Processing**:
```typescript
interface SpatialEvent {
  id: string;
  type: 'entity_moved' | 'entity_created' | 'entity_deleted' | 'boundary_crossed';
  location: GeoCoordinate;
  entity: SpatialEntity;
  timestamp: Date;
  metadata: Record<string, any>;
}
```

---

### 2. **RulesEngine.ts** - Alert Rules Management

**📁 Location**: `src/subapps/geo-canvas/alert-engine/rules/RulesEngine.ts`
**📊 Size**: 620+ lines
**🎯 Purpose**: Enterprise rules engine για complex alert logic

#### Τι κάνει:

##### **📋 Rule Management**:
```typescript
export class RulesEngine {
  // ➕ Create new alert rule
  async createRule(rule: CreateAlertRuleRequest): Promise<GeoAlertRule>

  // ✏️ Update existing rule
  async updateRule(id: string, updates: UpdateAlertRuleRequest): Promise<GeoAlertRule>

  // 🗑️ Delete rule
  async deleteRule(id: string): Promise<boolean>

  // 🔍 Evaluate rules against data
  async evaluateRule(rule: GeoAlertRule, context: EvaluationContext): Promise<boolean>
}
```

##### **🎯 Rule Types**:

**🔹 Geometric Rules**:
```typescript
// Boundary-based alerts
{
  type: 'boundary',
  geometry: GeoJSON.Polygon,
  trigger: 'enter' | 'exit' | 'inside' | 'outside'
}

// Distance-based alerts
{
  type: 'proximity',
  centerPoint: GeoCoordinate,
  radius: number,
  trigger: 'approaching' | 'departing' | 'within'
}
```

**🔹 Temporal Rules**:
```typescript
// Time-based constraints
{
  type: 'temporal',
  schedule: {
    startTime: string,    // "09:00"
    endTime: string,      // "17:00"
    days: string[],       // ["monday", "tuesday", ...]
    timezone: string      // "Europe/Athens"
  }
}
```

**🔹 Conditional Rules**:
```typescript
// Complex conditional logic
{
  type: 'conditional',
  conditions: [
    { field: 'speed', operator: '>', value: 50 },
    { field: 'direction', operator: '==', value: 'north' },
    { field: 'weather', operator: 'includes', value: 'rain' }
  ],
  logic: 'AND' | 'OR'
}
```

---

### 3. **NotificationDispatchEngine.ts** - Multi-Channel Notifications

**📁 Location**: `src/subapps/geo-canvas/alert-engine/notifications/NotificationDispatchEngine.ts`
**📊 Size**: 740+ lines
**🎯 Purpose**: Enterprise notification system με multiple delivery channels

#### Τι κάνει:

##### **📢 Notification Channels**:
```typescript
export class NotificationDispatchEngine {
  // 📧 Email notifications
  async sendEmail(
    alert: AlertInstance,
    recipients: string[],
    template?: EmailTemplate
  ): Promise<NotificationResult>

  // 💬 Slack notifications
  async sendSlack(
    alert: AlertInstance,
    channel: string,
    webhook?: string
  ): Promise<NotificationResult>

  // 📱 SMS notifications
  async sendSMS(
    alert: AlertInstance,
    phoneNumbers: string[]
  ): Promise<NotificationResult>

  // 🔗 Webhook notifications
  async sendWebhook(
    alert: AlertInstance,
    webhookUrl: string,
    headers?: Record<string, string>
  ): Promise<NotificationResult>
}
```

##### **🎨 Template System**:
```typescript
interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'email' | 'slack' | 'sms' | 'webhook';
  subject?: string;
  body: string;
  variables: string[];      // Supported template variables
  formatting: 'text' | 'html' | 'markdown';
}

// Example template variables:
// {{alert.title}}, {{alert.location}}, {{alert.severity}},
// {{alert.timestamp}}, {{alert.description}}
```

##### **🔄 Delivery Management**:
```typescript
interface NotificationResult {
  id: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  channel: string;
  recipient: string;
  sentAt: Date;
  deliveredAt?: Date;
  error?: string;
  retryCount: number;
  nextRetryAt?: Date;
}
```

---

## 📊 DATABASE SERVICES {#database-services}

### 1. **DatabaseManager.ts** - Enterprise Database Management

**📁 Location**: `src/subapps/geo-canvas/database/connection/DatabaseManager.ts`
**📊 Size**: 480+ lines
**🎯 Purpose**: Enterprise PostgreSQL/PostGIS database management και connection pooling

#### Τι κάνει:

##### **🔗 Connection Management**:
```typescript
export class DatabaseManager {
  // 🏗️ Initialize database connections
  async initialize(config: DatabaseConfig): Promise<void>

  // 📊 Get database connection από pool
  async getConnection(): Promise<PoolClient>

  // 🔄 Execute query με automatic retries
  async query<T>(sql: string, params?: any[]): Promise<QueryResult<T>>

  // 📈 Get connection pool statistics
  getPoolStats(): PoolStats

  // 🧹 Cleanup και graceful shutdown
  async shutdown(): Promise<void>
}
```

##### **⚙️ Configuration**:
```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;

  // 🏊 Connection pool settings
  pool: {
    min: number;              // Minimum connections
    max: number;              // Maximum connections
    idle: number;             // Idle timeout (ms)
    acquire: number;          // Acquire timeout (ms)
    evict: number;            // Eviction interval (ms)
  };

  // 🔄 Retry settings
  retry: {
    attempts: number;         // Max retry attempts
    delay: number;            // Initial delay (ms)
    factor: number;           // Backoff factor
  };
}
```

---

### 2. **SpatialQueryEngine.ts** - PostGIS Spatial Queries

**📁 Location**: `src/subapps/geo-canvas/database/queries/SpatialQueryEngine.ts`
**📊 Size**: 890+ lines
**🎯 Purpose**: Enterprise spatial query engine για PostGIS database operations

#### Τι κάνει:

##### **🗺️ Spatial Query Operations**:
```typescript
export class SpatialQueryEngine {
  // 📍 Point-in-polygon queries
  async findEntitiesInPolygon(
    polygon: GeoJSON.Polygon,
    entityType?: string
  ): Promise<SpatialEntity[]>

  // 📏 Distance-based queries
  async findEntitiesWithinDistance(
    center: GeoCoordinate,
    radiusMeters: number,
    entityType?: string
  ): Promise<SpatialEntity[]>

  // 🔍 Intersection queries
  async findIntersectingEntities(
    geometry: GeoJSON.Geometry,
    entityType?: string
  ): Promise<SpatialEntity[]>

  // 📊 Spatial analytics
  async calculateSpatialStatistics(
    geometries: GeoJSON.Geometry[]
  ): Promise<SpatialStatistics>
}
```

##### **📊 PostGIS Function Integration**:
```sql
-- Example spatial queries generated
SELECT
  entity_id,
  ST_AsGeoJSON(geometry) as geometry,
  ST_Distance(geometry, ST_GeomFromText($1, 4326)) as distance
FROM spatial_entities
WHERE ST_DWithin(geometry, ST_GeomFromText($1, 4326), $2)
ORDER BY distance;
```

##### **⚡ Performance Optimization**:
- **Spatial Indexes**: Automatic spatial index usage
- **Query Caching**: Redis-based query result caching
- **Batch Operations**: Optimized batch processing
- **Connection Pooling**: Efficient database connection management

---

*Συνεχίζεται στο επόμενο τμήμα με UI System και Database Schema...*
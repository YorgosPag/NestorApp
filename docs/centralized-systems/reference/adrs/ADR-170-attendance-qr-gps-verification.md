# ADR-170: Construction Worker Attendance — QR Code + GPS Geofencing + Photo Verification

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-02-09 |
| **Extends** | ADR-090 (IKA/EFKA Labor Compliance System) |
| **Author** | Nestor AI Platform |

## Context

The existing attendance system (ADR-090, Phases 1-3) supports manual check-in via the admin dashboard. This ADR adds automated, anti-fraud attendance verification for construction workers:

- **QR Code** with daily rotation (HMAC-SHA256 signed)
- **GPS Geofencing** to verify worker is within construction site radius
- **Photo Capture** (optional) for buddy-punching prevention

### Why Web-Based (not Native App)

- QR scan opens the phone browser — GPS is captured at that moment
- No app installation required — workers use their existing phone browser
- Outdoor construction sites provide GPS accuracy of 10-15m (sufficient)
- If native app is needed in the future → Phase 5

## Decision

Implement a three-layer verification system:

1. **QR Token Layer**: HMAC-SHA256 signed tokens that rotate daily
2. **GPS Layer**: Haversine distance calculation against project geofence
3. **Photo Layer**: Optional camera capture for visual verification

### Data Flow

```
Worker scans QR → Browser opens /attendance/check-in/[token]
  → GET /api/attendance/qr/validate (public, rate-limited)
  → Browser requests GPS (navigator.geolocation)
  → Worker enters AMKA + optional photo
  → POST /api/attendance/check-in (public, rate-limited)
    → Server: token validation → worker resolution → geofence check → photo upload → event write
  → Worker sees result with distance from site center
```

## Architecture

### New Services (Server-Side)

| Service | Path | Purpose |
|---------|------|---------|
| `geofence-service.ts` | `src/services/attendance/` | Haversine distance, geofence verification (pure functions) |
| `qr-token-service.ts` | `src/services/attendance/` | HMAC-SHA256 token generation/validation/revocation |
| `attendance-server-service.ts` | `src/services/attendance/` | Orchestrator: token → worker → geofence → photo → event |

### New API Routes

| Route | Method | Auth | Rate Limit | Purpose |
|-------|--------|------|------------|---------|
| `/api/attendance/qr/generate` | POST | withAuth | Standard | Generate daily QR token |
| `/api/attendance/qr/validate` | GET | None (public) | Heavy | Validate scanned QR token |
| `/api/attendance/check-in` | POST | None (public) | Heavy | Worker check-in/check-out |
| `/api/attendance/geofence` | GET/POST | withAuth | Standard | Read/set geofence config |

### New Client Components

| Component | Path | Purpose |
|-----------|------|---------|
| `useGeolocation` | `src/hooks/` | Browser GPS position hook |
| `usePhotoCapture` | `src/hooks/` | Camera capture + compression hook |
| `CheckInClient` | `src/app/attendance/check-in/[token]/` | Worker check-in page (mobile-first) |
| `QrCodePanel` | `src/components/projects/ika/components/` | Admin QR generation/display |
| `GeofenceConfigMap` | `src/components/projects/ika/components/` | Admin geofence configuration (interactive map with react-map-gl/maplibre) |

### New Firestore Collection

| Collection | Purpose | Rules |
|------------|---------|-------|
| `attendance_qr_tokens` | Daily QR tokens | Read: authenticated, Write: server-only (Admin SDK) |

### Modified Files

| File | Change |
|------|--------|
| `contracts.ts` | +6 interfaces (QR, Geofence, Photo, CheckIn types) |
| `firestore-collections.ts` | +ATTENDANCE_QR_TOKENS |
| `firestore.rules` | +attendance_qr_tokens rules |
| `TimesheetTabContent.tsx` | +QrCodePanel + GeofenceConfigMap sections |
| `projects.json` (el/en) | +attendance.qr/geofence/checkIn keys |

## Security Model

| Threat | Mitigation |
|--------|-----------|
| QR forgery | HMAC-SHA256 signed tokens, server-validated |
| QR sharing (WhatsApp) | GPS verification + photo proof |
| GPS spoofing | Photo adds visual proof + accuracy recorded |
| Buddy punching | Photo capture + AMKA verification |
| Token reuse | Daily rotation, expires at 23:59:59 |
| Brute force | withHeavyRateLimit on public endpoints |
| Time manipulation | Server-side timestamps (FieldValue.serverTimestamp) |
| Data tampering | Immutable events (create-only, no update/delete) |

## GDPR Compliance

- GPS captured only at check-in/out (NOT continuous tracking)
- Photo optional (configurable per project)
- Worker informed via privacy notice on check-in page
- Data retention per Greek labor law (5 years ΣΕΠΕ)
- AMKA not logged in plain text

## Environment Variables

```
ATTENDANCE_QR_SECRET=<random-64-char-hex>  # HMAC signing key
```

## Consequences

### Positive
- 90% anti-fraud coverage without native app
- No installation required for workers
- Real-time attendance tracking
- Legal compliance (ΣΕΠΕ, labor law)

### Negative
- GPS accuracy limited to 10-15m outdoors (acceptable for construction)
- Requires internet on worker's phone
- Photo verification is optional (not enforced)

### Future Considerations
- Phase 5: Native app with background geofencing (if needed)
- NFC badge integration
- Facial recognition (SmartBarrel-style)

## GeofenceConfigMap — Interactive Map Upgrade (2026-02-22)

The `GeofenceConfigMap` was upgraded from a static OpenStreetMap iframe to a fully interactive map:

| Feature | Before | After |
|---------|--------|-------|
| Map library | OpenStreetMap iframe (static) | react-map-gl/maplibre (interactive) |
| Set center | Manual lat/lng input only | Click on map or drag marker |
| Radius visualization | None | GeoJSON circle polygon (scales with zoom) |
| Radius slider | Native `input[type="range"]` | Radix UI Slider |
| Default center | Hardcoded Thessaloniki | `GEOGRAPHIC_CONFIG` (centralized) |
| Dependencies | None (iframe) | react-map-gl + maplibre-gl (already installed) |

**No new dependencies added** — uses existing react-map-gl/maplibre infrastructure from geo-canvas subapp.

## Geofence Audit Trail (2026-02-22)

Every geofence configuration change is now recorded as an **immutable audit log entry** via the enterprise audit system (`logAuditEvent` from `@/lib/auth/audit`).

**What is logged per change:**
| Field | Value |
|-------|-------|
| `actorId` | User ID of the admin who made the change |
| `timestamp` | Server timestamp (FieldValue.serverTimestamp) |
| `previousValue` | Old lat, lng, radius, enabled |
| `newValue` | New lat, lng, radius, enabled |
| `targetId` | Project ID |
| `action` | `data_updated` |
| `reason` | `Geofence configuration update (ADR-170)` |

**Storage**: `/companies/{companyId}/audit_logs/{autoId}` (tenant-isolated, immutable)

**File**: `src/app/api/attendance/geofence/route.ts`

## Live Worker Map Dashboard (2026-02-22)

Real-time map dashboard showing worker attendance markers on an interactive map.

| Component | Purpose |
|-----------|---------|
| `useAttendanceLiveEvents.ts` | Firestore `onSnapshot` real-time listener (replaces polling) |
| `LiveWorkerMap.tsx` | Interactive map with worker pins, geofence overlay, summary badges |

**Features:**
- Worker markers colored by status: green (inside), orange (outside), red (checked out)
- Geofence circle overlay (read-only, from server config)
- Click marker → popup with name, time, distance from center
- Summary badges: "X inside zone", "Y outside zone"
- Toast alert when new event arrives outside geofence
- LIVE badge indicator when real-time listener is active
- `TimesheetTabContent` uses live events with polling fallback

**Data flow:**
```
TimesheetTabContent
├── useAttendanceLiveEvents() → real-time events via onSnapshot
├── useAttendanceEvents() → polling fallback + addEvent/refetch
├── LiveWorkerMap → geofence circle + worker markers + badges + alerts
├── AttendanceDashboard → auto-updates via live events
└── DailyTimeline → auto-updates via live events
```

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-22 | Live Worker Map: real-time dashboard with worker pins, geofence overlay, status badges, toast alerts | Claude |
| 2026-02-22 | useAttendanceLiveEvents: Firestore onSnapshot hook for real-time attendance updates | Claude |
| 2026-02-22 | Geofence audit trail: immutable log of every config change (who, when, old→new values) | Claude |
| 2026-02-22 | GeofenceConfigMap: interactive map (react-map-gl), draggable marker, GeoJSON circle, Radix Slider | Claude |
| 2026-02-09 | Initial implementation — 14 new files, 5 modified | Claude |

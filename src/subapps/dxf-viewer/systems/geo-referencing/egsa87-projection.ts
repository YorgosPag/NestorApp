/**
 * ADR-656 M12 — ΕΓΣΑ87 (GGRS87) Transverse-Mercator projection + meridian convergence.
 *
 * Greece's national grid: a SINGLE Transverse Mercator zone on the GRS80 ellipsoid, central
 * meridian λ₀ = 24° E, scale k₀ = 0.9996, false easting 500 000 m, false northing 0. No proj
 * library exists in the repo (verified) and the North arrow needs the **meridian convergence**
 * γ (angle between Grid North and True North) at the survey location — so this compact pure
 * module provides the standard Snyder/Redfearn series both ways plus γ.
 *
 * Everything here is in **metres / degrees** (the geodesy convention). Callers holding canonical
 * mm (ADR-462) convert at the boundary (`lengthMmToM`) — this module stays unit-clean and
 * store-free, so it is exhaustively round-trip testable.
 *
 * @see https://pubs.usgs.gov/pp/1395/report.pdf — Snyder, Map Projections §8 (Transverse Mercator)
 */

const DEG = Math.PI / 180;

// GRS80 ellipsoid + ΕΓΣΑ87 grid constants.
const A = 6_378_137.0;                    // semi-major axis (m)
const F = 1 / 298.257222101;              // flattening
const E2 = F * (2 - F);                   // first eccentricity²
const EP2 = E2 / (1 - E2);                // second eccentricity² (e'²)
const K0 = 0.9996;                        // scale factor on the central meridian
const LON0 = 24 * DEG;                    // central meridian (24° E), radians
const FALSE_EASTING = 500_000.0;          // m
const FALSE_NORTHING = 0.0;               // m

/** Geographic coordinates (degrees). */
export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/** Grid coordinates (metres) — Easting / Northing in ΕΓΣΑ87. */
export interface GridEN {
  readonly E: number;
  readonly N: number;
}

/** Meridian arc length from the equator to latitude φ (radians), on the GRS80 ellipsoid. */
function meridianArc(phi: number): number {
  return A * (
    (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256) * phi
    - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 * E2 * E2 / 1024) * Math.sin(2 * phi)
    + (15 * E2 * E2 / 256 + 45 * E2 * E2 * E2 / 1024) * Math.sin(4 * phi)
    - (35 * E2 * E2 * E2 / 3072) * Math.sin(6 * phi)
  );
}

/** Footpoint latitude (radians) for a northing — inverse of the meridian arc (Snyder 3-21). */
function footpointLatitude(N: number): number {
  const M = (N - FALSE_NORTHING) / K0;
  const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  return mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
}

/** Geographic (deg) → ΕΓΣΑ87 grid (m). Forward Transverse Mercator (Snyder 8-9…8-11). */
export function geographicToGrid(lat: number, lon: number): GridEN {
  const phi = lat * DEG;
  const dl = lon * DEG - LON0;
  const sinP = Math.sin(phi);
  const cosP = Math.cos(phi);
  const nu = A / Math.sqrt(1 - E2 * sinP * sinP);
  const T = Math.tan(phi) ** 2;
  const C = EP2 * cosP * cosP;
  const Aa = dl * cosP;
  const M = meridianArc(phi);
  const E = FALSE_EASTING + K0 * nu * (
    Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120
  );
  const N = FALSE_NORTHING + K0 * (
    M + nu * Math.tan(phi) * (
      Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720
    )
  );
  return { E, N };
}

/** ΕΓΣΑ87 grid (m) → geographic (deg). Inverse Transverse Mercator (Snyder 8-17…8-25). */
export function gridToGeographic(E: number, N: number): LatLon {
  const phi1 = footpointLatitude(N);
  const sinP1 = Math.sin(phi1);
  const cosP1 = Math.cos(phi1);
  const tanP1 = Math.tan(phi1);
  const C1 = EP2 * cosP1 * cosP1;
  const T1 = tanP1 * tanP1;
  const nu1 = A / Math.sqrt(1 - E2 * sinP1 * sinP1);
  const rho1 = A * (1 - E2) / (1 - E2 * sinP1 * sinP1) ** 1.5;
  const D = (E - FALSE_EASTING) / (nu1 * K0);
  const phi = phi1 - (nu1 * tanP1 / rho1) * (
    D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720
  );
  const lon = LON0 + (
    D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120
  ) / cosP1;
  return { lat: phi / DEG, lon: lon / DEG };
}

/**
 * Meridian convergence γ (degrees) at a grid point: the angle between Grid North (the +Northing
 * axis) and True North. Zero on the central meridian (E = 500 000); positive east of it in the
 * northern hemisphere (Grid North lies east of True North → the True-North arrow tilts west).
 * The spherical form `γ = atan(tan Δλ · sinφ)` is accurate to < 1″ across Greece (|Δλ| ≤ 4°).
 */
export function meridianConvergenceDeg(E: number, N: number): number {
  const { lat, lon } = gridToGeographic(E, N);
  const dl = (lon - 24) * DEG;
  return Math.atan(Math.tan(dl) * Math.sin(lat * DEG)) / DEG;
}

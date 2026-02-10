/**
 * ACCURACY VALIDATION UTILITIES
 * Enterprise-class validation για georeferencing accuracy
 * Βασισμένο σε surveying standards και ISO 19157 (Data Quality)
 */

import type {
  GeoControlPoint,
  DxfCoordinate,
  GeoCoordinate
} from '../types';

// ============================================================================
// VALIDATION THRESHOLDS & STANDARDS
// ============================================================================

/**
 * Accuracy thresholds για different applications
 * Βασισμένο σε ASPRS (American Society for Photogrammetry & Remote Sensing) standards
 */
export const ACCURACY_THRESHOLDS = {
  // Surveying grade (sub-meter)
  SURVEY_GRADE: {
    excellent: 0.1,    // 10cm - Precise surveying
    good: 0.5,         // 50cm - Engineering surveys
    acceptable: 1.0,   // 1m - Mapping surveys
    poor: 2.0          // 2m - Reconnaissance
  },

  // Engineering applications
  ENGINEERING: {
    excellent: 1.0,    // 1m - Site planning
    good: 2.0,         // 2m - Preliminary design
    acceptable: 5.0,   // 5m - Conceptual design
    poor: 10.0         // 10m - Regional studies
  },

  // GIS applications
  GIS_MAPPING: {
    excellent: 5.0,    // 5m - Large scale mapping
    good: 10.0,        // 10m - Medium scale mapping
    acceptable: 25.0,  // 25m - Small scale mapping
    poor: 50.0         // 50m - Overview mapping
  }
} as const;

/**
 * Geometric Dilution of Precision (GDOP) thresholds
 * Lower values indicate better geometry
 */
export const GDOP_THRESHOLDS = {
  excellent: 1.0,
  good: 2.0,
  acceptable: 4.0,
  poor: 8.0
} as const;

// ============================================================================
// ACCURACY METRICS CALCULATION
// ============================================================================

export interface AccuracyMetrics {
  // Basic statistics
  rmsError: number;           // Root Mean Square error
  meanError: number;          // Average error
  maxError: number;           // Maximum error
  minError: number;           // Minimum error
  standardDeviation: number;  // Standard deviation

  // Advanced metrics
  ce90: number;               // Circular Error 90% (90% of points within this radius)
  ce95: number;               // Circular Error 95%
  le90: number;               // Linear Error 90%
  le95: number;               // Linear Error 95%

  // Geometric metrics
  gdop: number;               // Geometric Dilution of Precision
  spatialDistribution: 'excellent' | 'good' | 'acceptable' | 'poor';

  // Quality assessment
  overallGrade: 'excellent' | 'good' | 'acceptable' | 'poor';
  applicationSuitability: {
    surveying: boolean;
    engineering: boolean;
    gisMapping: boolean;
  };
}

/**
 * Calculate comprehensive accuracy metrics
 */
export function calculateAccuracyMetrics(
  controlPoints: GeoControlPoint[],
  transformedPoints: GeoCoordinate[]
): AccuracyMetrics {
  if (controlPoints.length !== transformedPoints.length) {
    throw new Error('Control points and transformed points must have same length');
  }

  if (controlPoints.length === 0) {
    throw new Error('Cannot calculate metrics with empty point arrays');
  }

  // Calculate individual errors
  const errors: number[] = [];
  const linearErrorsX: number[] = [];
  const linearErrorsY: number[] = [];

  for (let i = 0; i < controlPoints.length; i++) {
    const expected = controlPoints[i].geoPoint;
    const actual = transformedPoints[i];

    // Calculate linear errors
    const errorX = Math.abs(actual.lng - expected.lng) * 111320 * Math.cos(expected.lat * Math.PI / 180); // meters
    const errorY = Math.abs(actual.lat - expected.lat) * 111320; // meters

    linearErrorsX.push(errorX);
    linearErrorsY.push(errorY);

    // Calculate total error (Euclidean distance)
    const totalError = Math.sqrt(errorX * errorX + errorY * errorY);
    errors.push(totalError);
  }

  // Basic statistics
  const rmsError = Math.sqrt(errors.reduce((sum, err) => sum + err * err, 0) / errors.length);
  const meanError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
  const maxError = Math.max(...errors);
  const minError = Math.min(...errors);

  // Standard deviation
  const variance = errors.reduce((sum, err) => sum + Math.pow(err - meanError, 2), 0) / errors.length;
  const standardDeviation = Math.sqrt(variance);

  // Circular Error calculations
  const sortedErrors = [...errors].sort((a, b) => a - b);
  const ce90Index = Math.floor(sortedErrors.length * 0.90);
  const ce95Index = Math.floor(sortedErrors.length * 0.95);
  const ce90 = sortedErrors[ce90Index];
  const ce95 = sortedErrors[ce95Index];

  // Linear Error calculations
  const sortedErrorsX = [...linearErrorsX].sort((a, b) => a - b);
  const sortedErrorsY = [...linearErrorsY].sort((a, b) => a - b);
  const le90X = sortedErrorsX[Math.floor(sortedErrorsX.length * 0.90)];
  const le90Y = sortedErrorsY[Math.floor(sortedErrorsY.length * 0.90)];
  const le95X = sortedErrorsX[Math.floor(sortedErrorsX.length * 0.95)];
  const le95Y = sortedErrorsY[Math.floor(sortedErrorsY.length * 0.95)];

  const le90 = Math.sqrt(le90X * le90X + le90Y * le90Y);
  const le95 = Math.sqrt(le95X * le95X + le95Y * le95Y);

  // Geometric metrics
  const gdop = calculateGDOP(controlPoints.map(cp => cp.dxfPoint));
  const spatialDistribution = assessSpatialDistribution(controlPoints.map(cp => cp.dxfPoint));

  // Overall quality assessment
  const overallGrade = determineOverallGrade(rmsError, gdop, spatialDistribution);

  // Application suitability
  const applicationSuitability = {
    surveying: rmsError <= ACCURACY_THRESHOLDS.SURVEY_GRADE.acceptable && gdop <= GDOP_THRESHOLDS.good,
    engineering: rmsError <= ACCURACY_THRESHOLDS.ENGINEERING.acceptable && gdop <= GDOP_THRESHOLDS.acceptable,
    gisMapping: rmsError <= ACCURACY_THRESHOLDS.GIS_MAPPING.acceptable
  };

  return {
    rmsError,
    meanError,
    maxError,
    minError,
    standardDeviation,
    ce90,
    ce95,
    le90,
    le95,
    gdop,
    spatialDistribution,
    overallGrade,
    applicationSuitability
  };
}

// ============================================================================
// GEOMETRIC QUALITY ASSESSMENT
// ============================================================================

/**
 * Calculate Geometric Dilution of Precision (GDOP)
 */
function calculateGDOP(points: DxfCoordinate[]): number {
  if (points.length < 3) return Infinity;

  // Calculate bounding box
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  const width = maxX - minX;
  const height = maxY - minY;

  if (width === 0 || height === 0) return Infinity;

  // Calculate area and perimeter
  const area = width * height;
  const perimeter = 2 * (width + height);

  // GDOP is inversely related to how well points are distributed
  // Lower values indicate better geometry
  return perimeter * perimeter / (4 * Math.PI * area);
}

/**
 * Assess spatial distribution quality
 */
function assessSpatialDistribution(points: DxfCoordinate[]): 'excellent' | 'good' | 'acceptable' | 'poor' {
  if (points.length < 4) return 'poor';

  // Calculate bounding box
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  const width = maxX - minX;
  const height = maxY - minY;

  if (width === 0 || height === 0) return 'poor';

  // Define corner regions (20% margin from each corner)
  const margin = Math.min(width, height) * 0.2;
  const corners = [
    { minX, maxX: minX + margin, minY: maxY - margin, maxY }, // Top-left
    { minX: maxX - margin, maxX, minY: maxY - margin, maxY }, // Top-right
    { minX: maxX - margin, maxX, minY, maxY: minY + margin }, // Bottom-right
    { minX, maxX: minX + margin, minY, maxY: minY + margin }  // Bottom-left
  ];

  // Check corner coverage
  const cornersWithPoints = corners.filter(corner =>
    points.some(p =>
      p.x >= corner.minX && p.x <= corner.maxX &&
      p.y >= corner.minY && p.y <= corner.maxY
    )
  ).length;

  // Check center coverage
  const centerRegion = {
    minX: minX + width * 0.25,
    maxX: minX + width * 0.75,
    minY: minY + height * 0.25,
    maxY: minY + height * 0.75
  };

  const hasCenterPoint = points.some(p =>
    p.x >= centerRegion.minX && p.x <= centerRegion.maxX &&
    p.y >= centerRegion.minY && p.y <= centerRegion.maxY
  );

  // Determine quality based on coverage
  if (cornersWithPoints >= 4 && hasCenterPoint) return 'excellent';
  if (cornersWithPoints >= 4) return 'good';
  if (cornersWithPoints >= 3) return 'acceptable';
  return 'poor';
}

/**
 * Determine overall quality grade
 */
function determineOverallGrade(
  rmsError: number,
  gdop: number,
  spatialDistribution: string
): 'excellent' | 'good' | 'acceptable' | 'poor' {
  // Weight factors για different criteria
  const errorWeight = 0.4;
  const gdopWeight = 0.3;
  const distributionWeight = 0.3;

  // Normalize scores (0-100)
  let errorScore = 0;
  if (rmsError <= ACCURACY_THRESHOLDS.SURVEY_GRADE.excellent) errorScore = 100;
  else if (rmsError <= ACCURACY_THRESHOLDS.SURVEY_GRADE.good) errorScore = 80;
  else if (rmsError <= ACCURACY_THRESHOLDS.SURVEY_GRADE.acceptable) errorScore = 60;
  else if (rmsError <= ACCURACY_THRESHOLDS.ENGINEERING.acceptable) errorScore = 40;
  else errorScore = 20;

  let gdopScore = 0;
  if (gdop <= GDOP_THRESHOLDS.excellent) gdopScore = 100;
  else if (gdop <= GDOP_THRESHOLDS.good) gdopScore = 80;
  else if (gdop <= GDOP_THRESHOLDS.acceptable) gdopScore = 60;
  else gdopScore = 40;

  const distributionScores = { excellent: 100, good: 80, acceptable: 60, poor: 40 };
  const distributionScore = distributionScores[spatialDistribution as keyof typeof distributionScores];

  // Calculate weighted overall score
  const overallScore = (
    errorScore * errorWeight +
    gdopScore * gdopWeight +
    distributionScore * distributionWeight
  );

  // Determine grade
  if (overallScore >= 85) return 'excellent';
  if (overallScore >= 70) return 'good';
  if (overallScore >= 55) return 'acceptable';
  return 'poor';
}

// ============================================================================
// VALIDATION REPORTS
// ============================================================================

export interface ValidationReport {
  summary: {
    overall: 'pass' | 'warning' | 'fail';
    grade: 'excellent' | 'good' | 'acceptable' | 'poor';
    recommendation: string;
  };
  metrics: AccuracyMetrics;
  issues: {
    critical: string[];
    warnings: string[];
    recommendations: string[];
  };
  standards: {
    asprs: boolean;     // ASPRS accuracy standards
    iso19157: boolean;  // ISO 19157 data quality
    fgdc: boolean;      // FGDC standards
  };
}

/**
 * Generate comprehensive validation report
 */
export function generateValidationReport(
  controlPoints: GeoControlPoint[],
  transformedPoints: GeoCoordinate[],
  targetApplication: 'surveying' | 'engineering' | 'gis' = 'engineering'
): ValidationReport {
  const metrics = calculateAccuracyMetrics(controlPoints, transformedPoints);
  const issues = { critical: [] as string[], warnings: [] as string[], recommendations: [] as string[] };

  // Get thresholds για target application
  const thresholds = ACCURACY_THRESHOLDS[targetApplication === 'surveying' ? 'SURVEY_GRADE' :
                                       targetApplication === 'engineering' ? 'ENGINEERING' : 'GIS_MAPPING'];

  // Critical issues
  if (metrics.rmsError > thresholds.poor) {
    issues.critical.push(`RMS Error (${metrics.rmsError.toFixed(2)}m) exceeds maximum threshold (${thresholds.poor}m)`);
  }

  if (metrics.gdop > GDOP_THRESHOLDS.poor) {
    issues.critical.push(`Poor geometric distribution (GDOP: ${metrics.gdop.toFixed(2)})`);
  }

  if (controlPoints.length < 4) {
    issues.critical.push('Insufficient control points (minimum 4 recommended για reliable transformation)');
  }

  // Warnings
  if (metrics.rmsError > thresholds.acceptable) {
    issues.warnings.push(`RMS Error (${metrics.rmsError.toFixed(2)}m) exceeds recommended threshold (${thresholds.acceptable}m)`);
  }

  if (metrics.maxError > metrics.rmsError * 3) {
    issues.warnings.push(`Outlier detected: Max error (${metrics.maxError.toFixed(2)}m) is much larger than RMS`);
  }

  if (metrics.spatialDistribution === 'poor') {
    issues.warnings.push('Poor spatial distribution of control points');
  }

  // Recommendations
  if (metrics.spatialDistribution !== 'excellent') {
    issues.recommendations.push('Add control points στις γωνίες της περιοχής για better coverage');
  }

  if (metrics.rmsError > thresholds.good) {
    issues.recommendations.push('Improve control point accuracy or add more precise measurements');
  }

  if (controlPoints.length < 6) {
    issues.recommendations.push('Consider adding more control points για redundancy και better accuracy');
  }

  // Standards compliance
  const standards = {
    asprs: metrics.rmsError <= thresholds.acceptable && metrics.gdop <= GDOP_THRESHOLDS.acceptable,
    iso19157: metrics.overallGrade !== 'poor',
    fgdc: metrics.rmsError <= thresholds.poor && controlPoints.length >= 4
  };

  // Overall assessment
  const overall = issues.critical.length > 0 ? 'fail' :
                 issues.warnings.length > 0 ? 'warning' : 'pass';

  const recommendations = [
    'excellent: Ready για production use',
    'good: Suitable για most applications',
    'acceptable: Usable με caution',
    'poor: Requires improvement before use'
  ];

  const recommendation = recommendations.find(r => r.startsWith(metrics.overallGrade)) || 'Unknown quality level';

  return {
    summary: {
      overall,
      grade: metrics.overallGrade,
      recommendation: recommendation.split(': ')[1]
    },
    metrics,
    issues,
    standards
  };
}

export default {
  calculateAccuracyMetrics,
  generateValidationReport,
  ACCURACY_THRESHOLDS,
  GDOP_THRESHOLDS
};
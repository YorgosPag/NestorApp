import type { Point2D } from '../../../core/canvas/primitives/coordinates';
import { CoordinateUtils } from '../../../core/canvas/primitives/coordinates';
import type { GeographicPoint, GeographicTransform } from './geo-canvas-types';

export const geoToCanvasPoint = (
  geoPoint: GeographicPoint,
  canvas: HTMLCanvasElement,
  _transform: GeographicTransform,
): Point2D => {
  const rect = canvas.getBoundingClientRect();
  const x = ((geoPoint.lng + 180) / 360) * rect.width;
  const latRadians = (geoPoint.lat * Math.PI) / 180;
  const mercatorNorth = Math.log(Math.tan(Math.PI / 4 + latRadians / 2));
  const y = rect.height / 2 - (rect.width * mercatorNorth) / (2 * Math.PI);

  return CoordinateUtils.point2D(x, y);
};

export const canvasToGeoPoint = (
  canvasPoint: Point2D,
  canvas: HTMLCanvasElement,
  _transform: GeographicTransform,
): GeographicPoint => {
  const rect = canvas.getBoundingClientRect();
  const lng = (canvasPoint.x / rect.width) * 360 - 180;
  const mercatorFactor = Math.PI - (2 * Math.PI * canvasPoint.y) / rect.height;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(mercatorFactor) - Math.exp(-mercatorFactor)));

  return { lat, lng };
};

import { coordTransforms, type ViewTransform, type Point2D, MARGINS } from '../../systems/rulers-grid/config';

export function createTransformHelpers(
  currentTransformRef: React.MutableRefObject<ViewTransform>,
  canvas: HTMLCanvasElement
) {
  const worldToScreen = (p: Point2D) => {
    const t = currentTransformRef.current;
    return { x: p.x * t.scale + t.offsetX, y: p.y * t.scale + t.offsetY };
  };

  const screenToWorld = (screenPt: Point2D) => {
    return coordTransforms.screenToWorld(screenPt, currentTransformRef.current, canvas.getBoundingClientRect());
  };

  const worldToScreenOfficial = (worldPt: Point2D) => {
    return coordTransforms.worldToScreen(worldPt, currentTransformRef.current, canvas.getBoundingClientRect());
  };

  const setTransform = (transform: ViewTransform) => {
    currentTransformRef.current = { ...currentTransformRef.current, ...transform };
  };

  const getRulerOffsetCss = () => MARGINS.left;

  return {
    worldToScreen,
    screenToWorld,
    worldToScreenOfficial,
    setTransform,
    getRulerOffsetCss
  };
}
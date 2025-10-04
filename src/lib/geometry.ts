export interface Point {
  x: number;
  y: number;
}

export const getCentroid = (vertices: Array<{ x: number; y: number }>): { x: number; y: number } => {
  if (!vertices || vertices.length === 0) return { x: 0, y: 0 };
  return vertices.reduce(
    (acc, vertex) => ({
      x: acc.x + vertex.x / vertices.length,
      y: acc.y + vertex.y / vertices.length,
    }),
    { x: 0, y: 0 }
  );
};


export const distanceToLineSegment = (p: Point, v: Point, w: Point) => {
    const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return Math.sqrt((p.x - v.x)**2 + (p.y - v.y)**2);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const closestPoint = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return Math.sqrt((p.x - closestPoint.x)**2 + (p.y - closestPoint.y)**2);
}

/**
 * Spatial Polygon Intersection Utility
 * Pure TypeScript implementation of 2D Polygon-Polygon Intersection & Point-in-Polygon
 * for cadastral land parcel selection against drawn user acquisition boundaries.
 */

export type Point = [number, number] // [longitude, latitude]
export type Polygon = Point[]
export type BoundingBox = [number, number, number, number] // [minLng, minLat, maxLng, maxLat]

/**
 * Returns bounding box for a given polygon ring
 */
export function getBoundingBox(polygon: Polygon): BoundingBox {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const [lng, lat] of polygon) {
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }

  return [minLng, minLat, maxLng, maxLat]
}

/**
 * Checks if two bounding boxes overlap
 */
export function doBoundingBoxesOverlap(boxA: BoundingBox, boxB: BoundingBox): boolean {
  return (
    boxA[0] <= boxB[2] &&
    boxA[2] >= boxB[0] &&
    boxA[1] <= boxB[3] &&
    boxA[3] >= boxB[1]
  )
}

/**
 * Ray-casting algorithm to test if a point is inside a polygon
 */
export function isPointInPolygon(point: Point, polygon: Polygon): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Checks if line segment p1-p2 intersects line segment p3-p4
 */
export function doLineSegmentsIntersect(
  p1: Point,
  p2: Point,
  p3: Point,
  p4: Point
): boolean {
  function ccw(a: Point, b: Point, c: Point): boolean {
    return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0])
  }

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  )
}

/**
 * Full polygon-polygon intersection check.
 * Returns true if polyA and polyB intersect (contain vertices or cross edges).
 */
export function doPolygonsIntersect(polyA: Polygon, polyB: Polygon): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false

  // 1. Fast Bounding Box check
  const boxA = getBoundingBox(polyA)
  const boxB = getBoundingBox(polyB)
  if (!doBoundingBoxesOverlap(boxA, boxB)) {
    return false
  }

  // 2. Check if any vertex of polyA is inside polyB
  for (const pt of polyA) {
    if (isPointInPolygon(pt, polyB)) return true
  }

  // 3. Check if any vertex of polyB is inside polyA
  for (const pt of polyB) {
    if (isPointInPolygon(pt, polyA)) return true
  }

  // 4. Check if any edge of polyA intersects any edge of polyB
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i]
    const a2 = polyA[(i + 1) % polyA.length]

    for (let j = 0; j < polyB.length; j++) {
      const b1 = polyB[j]
      const b2 = polyB[(j + 1) % polyB.length]

      if (doLineSegmentsIntersect(a1, a2, b1, b2)) {
        return true
      }
    }
  }

  return false
}

/**
 * Normalizes GeoJSON coordinates or polygon array into a flat Polygon ring.
 */
export function parseGeoJSONRing(geometryJson: any): Polygon | null {
  if (!geometryJson) return null
  if (Array.isArray(geometryJson)) {
    if (Array.isArray(geometryJson[0]) && typeof geometryJson[0][0] === 'number') {
      return geometryJson as Polygon
    }
    if (Array.isArray(geometryJson[0]) && Array.isArray(geometryJson[0][0])) {
      return geometryJson[0] as Polygon
    }
  }
  if (geometryJson.type === 'Polygon' && Array.isArray(geometryJson.coordinates)) {
    return geometryJson.coordinates[0] as Polygon
  }
  return null
}

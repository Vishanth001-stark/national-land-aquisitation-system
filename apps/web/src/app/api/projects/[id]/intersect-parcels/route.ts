import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import {
  doPolygonsIntersect,
  parseGeoJSONRing,
  Point,
  Polygon,
} from '@/lib/spatial'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // 1. Authenticate caller
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Role Enforcement: CENTRAL_MINISTRY or SYSTEM_ADMIN only
    const userRole = session.user.role
    if (
      userRole !== ROLES.CENTRAL_MINISTRY &&
      userRole !== ROLES.SYSTEM_ADMIN
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Access restricted to authorized Central Ministry or System Admin officers' },
        { status: 403 }
      )
    }

    const resolvedParams = await context.params
    const projectId = resolvedParams?.id
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // 3. Parse drawn polygon geometry from request body
    const body = await request.json()
    let drawnPolygon: Polygon | null = null

    if (Array.isArray(body.polygonCoordinates) && body.polygonCoordinates.length >= 3) {
      drawnPolygon = body.polygonCoordinates as Polygon
    } else if (Array.isArray(body.bounds) && body.bounds.length === 4) {
      // Bounding box [minLng, minLat, maxLng, maxLat] -> Polygon ring
      const [minLng, minLat, maxLng, maxLat] = body.bounds
      drawnPolygon = [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ]
    }

    if (!drawnPolygon || drawnPolygon.length < 3) {
      return NextResponse.json(
        { error: 'Invalid acquisition boundary polygon coordinates provided' },
        { status: 400 }
      )
    }

    // 4. Fetch candidate cadastral land parcels
    const candidateParcels = await prisma.landParcel.findMany({
      where: {
        isCandidate: true,
      },
    })

    // 5. Intersect drawn polygon against candidate parcel geometries
    const intersectingParcels = candidateParcels.filter((parcel) => {
      if (!parcel.geometryJson) {
        // Fallback check against point location if geometryJson is missing
        if (parcel.longitude && parcel.latitude) {
          const point: Point = [Number(parcel.longitude), Number(parcel.latitude)]
          return drawnPolygon ? drawnPolygon.length >= 3 && require('@/lib/spatial').isPointInPolygon(point, drawnPolygon) : false
        }
        return false
      }

      const parcelRing = parseGeoJSONRing(parcel.geometryJson)
      if (!parcelRing) return false

      return doPolygonsIntersect(drawnPolygon!, parcelRing)
    })

    return NextResponse.json({
      success: true,
      projectId: project.id,
      projectName: project.name,
      drawnPolygon,
      intersectedCount: intersectingParcels.length,
      parcels: intersectingParcels,
    })
  } catch (error) {
    console.error('Error intersecting parcels:', error)
    return NextResponse.json(
      { error: 'Internal server error while intersecting land parcels' },
      { status: 500 }
    )
  }
}

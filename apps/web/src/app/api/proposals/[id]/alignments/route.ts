import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const uploadAlignmentSchema = z.object({
  alignmentName: z.string().min(3).max(100),
  bufferWidthMeters: z.number().int().positive().default(60),
  centerlineGeojson: z.any(), // GeoJSON object
})

function geojsonToWkt(geojson: any): string {
  // If it's a FeatureCollection or Feature, extract the geometry
  let geom = geojson;
  if (geojson.type === 'FeatureCollection') {
    geom = geojson.features?.[0]?.geometry;
  } else if (geojson.type === 'Feature') {
    geom = geojson.geometry;
  }

  if (!geom || geom.type !== 'LineString') {
    throw new Error('Geometry must be a GeoJSON LineString');
  }

  const coordinates = geom.coordinates;
  if (!coordinates || !Array.isArray(coordinates)) {
    throw new Error('Invalid GeoJSON coordinates');
  }

  const coordsStr = coordinates.map((c: any) => `${c[0]} ${c[1]}`).join(', ');
  return `LINESTRING(${coordsStr})`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await context.params
    const proposalId = resolvedParams?.id

    if (!proposalId) {
      return NextResponse.json({ error: 'Proposal ID is required' }, { status: 400 })
    }

    // Verify proposal exists
    const proposal = await prisma.projectProposal.findUnique({
      where: { id: proposalId },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = uploadAlignmentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { alignmentName, bufferWidthMeters, centerlineGeojson } = parsed.data

    let centerlineWkt = ''
    try {
      centerlineWkt = geojsonToWkt(centerlineGeojson)
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Invalid GeoJSON' }, { status: 400 })
    }

    // Run PostGIS Spatial Pre-Feasibility Engine
    // Calculates length, overlaps with forest/eco-sensitive zones, waterbodies and utility crossings
    const query = `
      WITH input_geom AS (
        SELECT ST_GeomFromText($1, 4326) AS centerline
      ),
      corridor AS (
        SELECT ST_Buffer(centerline::geography, $2)::geometry AS geom FROM input_geom
      ),
      forest_stats AS (
        SELECT COALESCE(SUM(ST_Area(ST_Intersection(corridor.geom, f.geom)::geography) / 10000.0), 0) AS overlap_ha
        FROM corridor, forest_zones f
        WHERE ST_Intersects(corridor.geom, f.geom)
      ),
      water_stats AS (
        SELECT COALESCE(SUM(ST_Area(ST_Intersection(corridor.geom, w.geom)::geography) / 10000.0), 0) AS overlap_ha
        FROM corridor, water_bodies w
        WHERE ST_Intersects(corridor.geom, w.geom)
      ),
      utility_stats AS (
        SELECT COUNT(*)::int AS intersects_count
        FROM corridor, utility_crossings u
        WHERE ST_Intersects(corridor.geom, u.geom)
      ),
      length_stats AS (
        SELECT ST_Length(centerline::geography) / 1000.0 AS length_km FROM input_geom
      )
      SELECT
        length_km::float,
        forest_stats.overlap_ha::float AS forest_overlap_ha,
        water_stats.overlap_ha::float AS waterbody_overlap_ha,
        utility_stats.intersects_count AS utility_intersects
      FROM length_stats, forest_stats, water_stats, utility_stats;
    `

    const rawResult: any = await prisma.$queryRawUnsafe(query, centerlineWkt, bufferWidthMeters)
    const stats = rawResult[0] || { length_km: 0, forest_overlap_ha: 0, waterbody_overlap_ha: 0, utility_intersects: 0 }

    // Risk Score Vetting Rules
    let riskScore = 'LOW'
    if (stats.forest_overlap_ha > 10) {
      riskScore = 'HIGH'
    } else if (stats.forest_overlap_ha > 0 || stats.waterbody_overlap_ha > 0 || stats.utility_intersects > 0) {
      riskScore = 'MEDIUM'
    }

    // Save alignment using raw SQL to write geometry
    const id = crypto.randomUUID()
    await prisma.$executeRawUnsafe(`
      INSERT INTO proposal_alignments (
        id, proposal_id, alignment_name, buffer_width_meters,
        centerline_geom, corridor_geom, total_length_km,
        forest_overlap_ha, waterbody_overlap_ha, clearance_risk_score
      )
      VALUES (
        '${id}', '${proposalId}', '${alignmentName}', ${bufferWidthMeters},
        ST_GeomFromText('${centerlineWkt}', 4326),
        ST_Buffer(ST_GeomFromText('${centerlineWkt}', 4326)::geography, ${bufferWidthMeters})::geometry,
        ${stats.length_km}, ${stats.forest_overlap_ha}, ${stats.waterbody_overlap_ha}, '${riskScore}'
      );
    `)

    return NextResponse.json({
      success: true,
      alignment: {
        id,
        proposalId,
        alignmentName,
        bufferWidthMeters,
        totalLengthKm: stats.length_km,
        forestOverlapHa: stats.forest_overlap_ha,
        waterbodyOverlapHa: stats.waterbody_overlap_ha,
        clearanceRiskScore: riskScore,
        utilityIntersectsCount: stats.utility_intersects,
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error uploading alignment:', error)
    return NextResponse.json(
      { error: 'Internal server error processing alignment spatial logic' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await context.params
    const proposalId = resolvedParams?.id

    if (!proposalId) {
      return NextResponse.json({ error: 'Proposal ID is required' }, { status: 400 })
    }

    // Retrieve alignments with GeoJSON representations of centerline & corridor
    const query = `
      SELECT
        id,
        proposal_id AS "proposalId",
        alignment_name AS "alignmentName",
        is_preferred AS "isPreferred",
        buffer_width_meters AS "bufferWidthMeters",
        total_length_km::float AS "totalLengthKm",
        forest_overlap_ha::float AS "forestOverlapHa",
        waterbody_overlap_ha::float AS "waterbodyOverlapHa",
        clearance_risk_score AS "clearanceRiskScore",
        ST_AsGeoJSON(centerline_geom) AS "centerlineGeojson",
        ST_AsGeoJSON(corridor_geom) AS "corridorGeojson"
      FROM proposal_alignments
      WHERE proposal_id = $1
      ORDER BY is_preferred DESC, alignment_name ASC;
    `

    const alignments: any[] = await prisma.$queryRawUnsafe(query, proposalId)

    // Parse coordinates from GeoJSON strings
    const formatted = alignments.map((a) => ({
      ...a,
      centerlineGeojson: a.centerlineGeojson ? JSON.parse(a.centerlineGeojson) : null,
      corridorGeojson: a.corridorGeojson ? JSON.parse(a.corridorGeojson) : null,
    }))

    return NextResponse.json(formatted)
  } catch (error) {
    console.error('Error fetching alignments:', error)
    return NextResponse.json(
      { error: 'Internal server error loading alignments' },
      { status: 500 }
    )
  }
}

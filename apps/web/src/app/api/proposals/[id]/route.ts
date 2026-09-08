import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

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

    // 1. Fetch proposal with state, district, clearances and financial sanction
    const proposal = await prisma.projectProposal.findUnique({
      where: { id: proposalId },
      include: {
        state: true,
        district: true,
        clearances: {
          orderBy: { clearanceType: 'asc' },
        },
        financialSanction: true,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // 2. Fetch corridor alignments with spatial GeoJSON
    const alignmentsQuery = `
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

    const rawAlignments: any[] = await prisma.$queryRawUnsafe(alignmentsQuery, proposalId)
    const formattedAlignments = rawAlignments.map((a) => ({
      ...a,
      centerlineGeojson: a.centerlineGeojson ? JSON.parse(a.centerlineGeojson) : null,
      corridorGeojson: a.corridorGeojson ? JSON.parse(a.corridorGeojson) : null,
    }))

    // 3. Look up downstream Land Acquisition Project (if sanctioned)
    let linkedProject = null
    if (proposal.projectId) {
      linkedProject = await prisma.project.findUnique({
        where: { id: proposal.projectId },
        include: {
          workflowInstances: {
            orderBy: { startedAt: 'desc' },
          },
          state: true,
          district: true,
        },
      })
    } else if (proposal.status === 'AA_FS_SANCTIONED') {
      // Fallback matching by name
      linkedProject = await prisma.project.findFirst({
        where: { name: proposal.title },
        include: {
          workflowInstances: {
            orderBy: { startedAt: 'desc' },
          },
          state: true,
          district: true,
        },
      })
    }

    return NextResponse.json({
      ...proposal,
      alignments: formattedAlignments,
      project: linkedProject,
    })
  } catch (error) {
    console.error('Error fetching proposal details:', error)
    return NextResponse.json(
      { error: 'Internal server error loading proposal' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = session.user.role
    if (userRole !== ROLES.CENTRAL_MINISTRY && userRole !== ROLES.SYSTEM_ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden: Only Central Ministry or System Admin can delete proposals' },
        { status: 403 }
      )
    }

    const resolvedParams = await context.params
    const proposalId = resolvedParams?.id

    if (!proposalId) {
      return NextResponse.json({ error: 'Proposal ID is required' }, { status: 400 })
    }

    const existing = await prisma.projectProposal.findUnique({
      where: { id: proposalId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    await prisma.projectProposal.delete({
      where: { id: proposalId },
    })

    return NextResponse.json({ success: true, message: 'Proposal deleted successfully' })
  } catch (error) {
    console.error('Error deleting proposal:', error)
    return NextResponse.json(
      { error: 'Internal server error deleting proposal' },
      { status: 500 }
    )
  }
}

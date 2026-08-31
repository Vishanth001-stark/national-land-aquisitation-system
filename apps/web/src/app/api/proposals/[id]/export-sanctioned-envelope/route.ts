import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const proposal = await prisma.projectProposal.findUnique({
      where: { id: proposalId },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    if (proposal.status !== 'AA_FS_SANCTIONED') {
      return NextResponse.json(
        { error: 'Forbidden: Project envelope can only be exported after AA&FS Financial Sanction is approved.' },
        { status: 403 }
      )
    }

    // Retrieve preferred geometry and metadata
    const query = `
      SELECT
        p.title,
        p.proposal_code AS "proposalCode",
        p.sponsoring_ministry AS "sponsoringMinistry",
        p.category AS "category",
        p.estimated_budget_cr::float AS "estimatedBudgetCr",
        f.sanction_order_no AS "sanctionOrderNo",
        f.sanctioned_amount_cr::float AS "sanctionedAmountCr",
        f.land_acquisition_budget_cr::float AS "landAcquisitionBudgetCr",
        f.civil_works_budget_cr::float AS "civilWorksBudgetCr",
        f.sanctioning_authority AS "sanctioningAuthority",
        f.sanction_date AS "sanctionDate",
        a.alignment_name AS "alignmentName",
        a.total_length_km::float AS "totalLengthKm",
        a.clearance_risk_score AS "clearanceRiskScore",
        ST_AsGeoJSON(a.centerline_geom) AS "centerlineGeojson",
        ST_AsGeoJSON(a.corridor_geom) AS "corridorGeojson"
      FROM project_proposals p
      JOIN proposal_alignments a ON a.proposal_id = p.id AND a.is_preferred = TRUE
      JOIN financial_sanctions f ON f.proposal_id = p.id
      WHERE p.id = $1;
    `

    const rawResult: any[] = await prisma.$queryRawUnsafe(query, proposalId)
    const data = rawResult[0]

    if (!data) {
      return NextResponse.json(
        { error: 'Spatial envelope not found. Check if preferred alignment and sanction details are fully synced.' },
        { status: 404 }
      )
    }

    const centerline = data.centerlineGeojson ? JSON.parse(data.centerlineGeojson) : null
    const corridor = data.corridorGeojson ? JSON.parse(data.corridorGeojson) : null

    // Construct Standard GeoJSON FeatureCollection
    const featureCollection = {
      type: 'FeatureCollection',
      properties: {
        proposalId,
        title: data.title,
        proposalCode: data.proposalCode,
        sponsoringMinistry: data.sponsoringMinistry,
        category: data.category,
        alignmentName: data.alignmentName,
        totalLengthKm: data.totalLengthKm,
        clearanceRiskScore: data.clearanceRiskScore,
        sanctionOrderNo: data.sanctionOrderNo,
        sanctionedAmountCr: data.sanctionedAmountCr,
        landAcquisitionBudgetCr: data.landAcquisitionBudgetCr,
        civilWorksBudgetCr: data.civilWorksBudgetCr,
        sanctioningAuthority: data.sanctioningAuthority,
        sanctionDate: data.sanctionDate,
      },
      features: [
        {
          type: 'Feature',
          properties: {
            layerType: 'Project_Corridor_RoW',
            description: 'Buffer zone corridor / Right-of-Way boundary',
          },
          geometry: corridor,
        },
        {
          type: 'Feature',
          properties: {
            layerType: 'Project_Centerline',
            description: 'Centerline alignment path',
          },
          geometry: centerline,
        },
      ],
    }

    return NextResponse.json(featureCollection)
  } catch (error) {
    console.error('Error exporting sanctioned envelope:', error)
    return NextResponse.json(
      { error: 'Internal server error exporting sanctioned envelope' },
      { status: 500 }
    )
  }
}

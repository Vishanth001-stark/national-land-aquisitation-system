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

    // Fetch basic comparison metrics
    const alignments = await prisma.proposalAlignment.findMany({
      where: { proposalId },
      select: {
        id: true,
        alignmentName: true,
        isPreferred: true,
        bufferWidthMeters: true,
        totalLengthKm: true,
        forestOverlapHa: true,
        waterbodyOverlapHa: true,
        clearanceRiskScore: true,
      },
      orderBy: { isPreferred: 'desc' },
    })

    return NextResponse.json({
      proposalId,
      alignments: alignments.map((a) => ({
        ...a,
        totalLengthKm: a.totalLengthKm ? Number(a.totalLengthKm) : 0,
        forestOverlapHa: a.forestOverlapHa ? Number(a.forestOverlapHa) : 0,
        waterbodyOverlapHa: a.waterbodyOverlapHa ? Number(a.waterbodyOverlapHa) : 0,
      })),
    })
  } catch (error) {
    console.error('Error comparing alignments:', error)
    return NextResponse.json(
      { error: 'Internal server error comparing alignments' },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get total proposals count
    const totalProposals = await prisma.proposal.count()

    // Get total land area
    const landAreaResult = await prisma.proposal.aggregate({
      _sum: {
        landArea: true,
      },
    })

    // Get total estimated cost
    const costResult = await prisma.proposal.aggregate({
      _sum: {
        estimatedCost: true,
      },
    })

    // Get proposals by status
    const proposalsByStatus = await prisma.proposal.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    })

    // Get recent proposals
    const recentProposals = await prisma.proposal.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        submittedByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      totalProposals,
      totalLandArea: landAreaResult._sum.landArea || 0,
      totalEstimatedCost: costResult._sum.estimatedCost || 0,
      proposalsByStatus,
      recentProposals,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
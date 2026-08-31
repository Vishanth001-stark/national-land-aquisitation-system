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

    // Run all DB queries in parallel
    const [
      totalProjects,
      projectAreaResult,
      projectCostResult,
      activeProjects,
      totalProposals,
      landAreaResult,
      costResult,
      proposalsByStatus,
      recentProposals,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.aggregate({ _sum: { totalAreaHectares: true } }),
      prisma.project.aggregate({ _sum: { estimatedCost: true } }),
      prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.proposal.count(),
      prisma.proposal.aggregate({ _sum: { landArea: true } }),
      prisma.proposal.aggregate({ _sum: { estimatedCost: true } }),
      prisma.proposal.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.proposal.findMany({
        where: {
          status: { not: 'converted' },
          project: null,
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          submittedByUser: {
            select: { name: true, email: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
      }),
    ])

    return NextResponse.json({
      // Project Stats
      totalProjects,
      totalProjectArea: projectAreaResult._sum.totalAreaHectares
        ? Number(projectAreaResult._sum.totalAreaHectares)
        : 0,
      totalProjectCost: projectCostResult._sum.estimatedCost
        ? Number(projectCostResult._sum.estimatedCost)
        : 0,
      activeProjects,
      // Proposal Stats
      totalProposals,
      totalLandArea: landAreaResult._sum.landArea ?? 0,
      totalEstimatedCost: costResult._sum.estimatedCost ?? 0,
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
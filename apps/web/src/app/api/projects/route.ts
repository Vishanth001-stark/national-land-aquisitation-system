import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    const role = session.user.role

    // Role-based filtering: only admins/ministry can see ALL projects
    const canViewAll =
      role === ROLES.CENTRAL_MINISTRY ||
      role === ROLES.SYSTEM_ADMIN ||
      role === ROLES.STATE_NODAL

    const where = canViewAll
      ? {}
      : role === ROLES.DISTRICT_COLLECTOR
      ? { districtId: session.user.districtId ?? undefined }
      : { createdBy: session.user.id }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          workflowInstances: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          landParcels: {
            select: {
              id: true,
              surveyNumber: true,
              areaHectares: true,
              possessionStatus: true,
            },
          },
          state: { select: { name: true, code: true } },
          district: { select: { name: true } },
        },
      }),
      prisma.project.count({ where }),
    ])

    return NextResponse.json({
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

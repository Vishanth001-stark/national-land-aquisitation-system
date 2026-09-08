import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { Prisma } from '@prisma/client'

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

    const body = await request.json()
    const { parcelIds } = body

    if (!Array.isArray(parcelIds) || parcelIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one parcel ID must be selected to confirm' },
        { status: 400 }
      )
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Execute confirmation transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update parcels with projectId
      await tx.landParcel.updateMany({
        where: {
          id: { in: parcelIds },
        },
        data: {
          projectId: project.id,
        },
      })

      // 2. Query updated parcels for project total area computation
      const projectParcels = await tx.landParcel.findMany({
        where: { projectId: project.id },
      })

      const totalHectares = projectParcels.reduce((sum, p) => {
        return sum + (p.areaHectares ? Number(p.areaHectares) : 0)
      }, 0)

      // 3. Update project total area
      await tx.project.update({
        where: { id: project.id },
        data: {
          totalAreaHectares: new Prisma.Decimal(totalHectares),
        },
      })

      // 4. Create audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: `CONFIRMED_LAND_SELECTION: ${parcelIds.length} parcels added to project`,
          entityType: 'Project',
          entityId: project.id,
        },
      })

      return projectParcels
    })

    return NextResponse.json({
      success: true,
      message: `Successfully confirmed ${result.length} land parcel(s) for ${project.name}`,
      confirmedCount: result.length,
      parcels: result,
    })
  } catch (error) {
    console.error('Error confirming parcels:', error)
    return NextResponse.json(
      { error: 'Failed to confirm land parcel selection for project' },
      { status: 500 }
    )
  }
}

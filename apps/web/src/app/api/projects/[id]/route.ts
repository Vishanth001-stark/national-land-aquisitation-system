import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // 1. Authenticate caller
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Authorize caller: CENTRAL_MINISTRY or SYSTEM_ADMIN only
    const userRole = session.user.role
    if (
      userRole !== ROLES.CENTRAL_MINISTRY &&
      userRole !== ROLES.SYSTEM_ADMIN
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Only Central Ministry or System Admin can delete projects' },
        { status: 403 }
      )
    }

    // 3. Resolve dynamic route parameter
    const resolvedParams = await context.params
    const projectId = resolvedParams?.id

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // Resolve user ID for audit log
    let userId = session.user.id
    if (!userId && session.user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      if (dbUser) {
        userId = dbUser.id
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Authenticated user ID could not be resolved' },
        { status: 401 }
      )
    }

    // 4. Find the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        proposal: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // 5. Delete in a transaction:
    // - delete documents
    // - delete land parcels
    // - delete workflow instances
    // - if proposal exists, reset its status to 'submitted'
    // - delete the project
    // - record an audit log
    await prisma.$transaction(async (tx) => {
      // Delete documents linked to project
      await tx.document.deleteMany({
        where: { projectId: project.id },
      })

      // Delete land parcels linked to project
      await tx.landParcel.deleteMany({
        where: { projectId: project.id },
      })

      // Delete workflow instances linked to project
      await tx.workflowInstance.deleteMany({
        where: { projectId: project.id },
      })

      // If project was created from a proposal, reopen/reset that proposal to submitted
      if (project.proposalId) {
        await tx.proposal.update({
          where: { id: project.proposalId },
          data: {
            status: 'submitted',
          },
        })
      }

      // Delete the project
      await tx.project.delete({
        where: { id: project.id },
      })

      // Create AuditLog
      await tx.auditLog.create({
        data: {
          userId,
          action: `PROJECT_DELETED:${project.name}`,
          entityType: 'Project',
          entityId: project.id,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: `Project "${project.name}" has been removed.`,
      projectId: project.id,
    })
  } catch (error) {
    console.error('Error deleting project:', error)
    return NextResponse.json(
      { error: 'Internal server error while removing project' },
      { status: 500 }
    )
  }
}

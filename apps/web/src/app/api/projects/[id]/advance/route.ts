import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { WorkflowStage, WorkflowStatus } from '@prisma/client'

// Fixed ordered workflow stages
export const WORKFLOW_STAGES: WorkflowStage[] = [
  WorkflowStage.SIA,
  WorkflowStage.PRELIMINARY_NOTIFICATION,
  WorkflowStage.OBJECTIONS_CONSENT,
  WorkflowStage.DECLARATION,
  WorkflowStage.AWARD,
  WorkflowStage.COMPENSATION,
  WorkflowStage.POSSESSION,
]

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

    // 2. Authorize caller - CENTRAL_MINISTRY or SYSTEM_ADMIN only
    const userRole = session.user.role
    if (
      userRole !== ROLES.CENTRAL_MINISTRY &&
      userRole !== ROLES.SYSTEM_ADMIN
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Only Central Ministry or System Admin can advance project stages' },
        { status: 403 }
      )
    }

    // Resolve dynamic route param
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

    // 3. Find project and its workflow instances
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        workflowInstances: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    const workflowInstance = project.workflowInstances[0]
    if (!workflowInstance) {
      return NextResponse.json(
        { error: 'No workflow instance found for this project' },
        { status: 400 }
      )
    }

    const previousStage = workflowInstance.currentStage

    // 4. Validate current stage and terminal condition
    if (previousStage === WorkflowStage.POSSESSION) {
      return NextResponse.json(
        { error: 'Project is already at the final possession stage.' },
        { status: 400 }
      )
    }

    const currentIndex = WORKFLOW_STAGES.indexOf(previousStage)
    if (currentIndex === -1) {
      return NextResponse.json(
        { error: `Unrecognized current stage: ${previousStage}` },
        { status: 400 }
      )
    }

    const nextStage = WORKFLOW_STAGES[currentIndex + 1]
    const isPossession = nextStage === WorkflowStage.POSSESSION

    const newWorkflowStatus: WorkflowStatus = isPossession
      ? WorkflowStatus.COMPLETED
      : WorkflowStatus.IN_PROGRESS
    const newProjectStatus = isPossession ? 'completed' : 'IN_PROGRESS'

    // 5. Execute atomic transaction
    const [updatedWorkflow] = await prisma.$transaction([
      prisma.workflowInstance.update({
        where: { id: workflowInstance.id },
        data: {
          currentStage: nextStage,
          status: newWorkflowStatus,
          ...(isPossession ? { completedAt: new Date() } : {}),
        },
      }),
      prisma.project.update({
        where: { id: project.id },
        data: {
          status: newProjectStatus,
        },
      }),
      prisma.landParcel.updateMany({
        where: { projectId: project.id },
        data: {
          possessionStatus: isPossession
            ? 'POSSESSED'
            : nextStage === WorkflowStage.AWARD || nextStage === WorkflowStage.COMPENSATION
            ? 'ACQUIRED'
            : 'NOT_ACQUIRED',
        },
      }),
      prisma.auditLog.create({
        data: {
          userId,
          action: `STAGE_ADVANCED:${previousStage}->${nextStage}`,
          entityType: 'Project',
          entityId: project.id,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: `Project workflow advanced from ${previousStage} to ${nextStage}`,
      projectId: project.id,
      previousStage,
      currentStage: updatedWorkflow.currentStage,
      workflowStatus: updatedWorkflow.status,
    })
  } catch (error) {
    console.error('Error advancing project stage:', error)
    return NextResponse.json(
      { error: 'Internal server error advancing project stage' },
      { status: 500 }
    )
  }
}

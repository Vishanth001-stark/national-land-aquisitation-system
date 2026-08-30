import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { ProjectType, WorkflowStage, WorkflowStatus, Prisma } from '@prisma/client'

/**
 * Deterministic helper to map proposal purpose/title to valid ProjectType enum.
 */
function resolveProjectType(title: string, purpose: string): ProjectType {
  const combined = `${title} ${purpose}`.toLowerCase()

  if (combined.includes('highway') || combined.includes('road') || combined.includes('expressway')) {
    return ProjectType.highway
  }
  if (combined.includes('rail') || combined.includes('train') || combined.includes('metro') || combined.includes('station')) {
    return ProjectType.railway
  }
  if (combined.includes('irrigation') || combined.includes('canal') || combined.includes('dam') || combined.includes('water')) {
    return ProjectType.irrigation
  }
  if (combined.includes('industrial') || combined.includes('corridor') || combined.includes('factory') || combined.includes('manufacturing')) {
    return ProjectType.industrial_corridor
  }
  if (combined.includes('solar') || combined.includes('wind') || combined.includes('energy') || combined.includes('power') || combined.includes('renewable')) {
    return ProjectType.renewable_energy
  }

  // Fallback to purpose keywords
  if (purpose.toLowerCase() === 'infrastructure') {
    return ProjectType.highway
  }
  if (purpose.toLowerCase() === 'industrial') {
    return ProjectType.industrial_corridor
  }

  // Documented default
  return ProjectType.urban_development
}

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

    // 2. Authorize caller: CENTRAL_MINISTRY or SYSTEM_ADMIN only
    const userRole = session.user.role
    if (
      userRole !== ROLES.CENTRAL_MINISTRY &&
      userRole !== ROLES.SYSTEM_ADMIN
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Only Central Ministry or System Admin can approve proposals' },
        { status: 403 }
      )
    }

    // 3. Resolve dynamic route parameter
    const resolvedParams = await context.params
    const proposalId = resolvedParams?.id

    if (!proposalId) {
      return NextResponse.json(
        { error: 'Proposal ID is required' },
        { status: 400 }
      )
    }

    // Resolve approving user ID
    let approverUserId = session.user.id
    if (!approverUserId && session.user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      if (dbUser) {
        approverUserId = dbUser.id
      }
    }

    if (!approverUserId) {
      return NextResponse.json(
        { error: 'Unable to identify approver user account' },
        { status: 500 }
      )
    }

    // 4. Find the Proposal by ID with relations
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        submittedByUser: {
          include: {
            state: true,
            district: true,
          },
        },
        project: true,
      },
    })

    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      )
    }

    // 5. Prevent duplicate conversion
    if (proposal.project || proposal.status === 'converted') {
      return NextResponse.json(
        {
          error: 'Conflict: This proposal has already been converted into a project.',
          projectId: proposal.project?.id,
        },
        { status: 409 }
      )
    }

    // 6. Determine Project Location (stateId and districtId)
    let stateId: string | null = null
    let districtId: string | null = null

    // Check if submitter has a valid district and state
    if (proposal.submittedByUser?.districtId && proposal.submittedByUser?.stateId) {
      stateId = proposal.submittedByUser.stateId
      districtId = proposal.submittedByUser.districtId
    }

    // Deterministic fallback: Look up an existing State and District from database
    if (!stateId || !districtId) {
      const fallbackDistrict = await prisma.district.findFirst({
        include: { state: true },
        orderBy: { createdAt: 'asc' },
      })

      if (fallbackDistrict) {
        stateId = fallbackDistrict.stateId
        districtId = fallbackDistrict.id
      }
    }

    if (!stateId || !districtId) {
      return NextResponse.json(
        { error: 'State and district must be configured in the system before proposal approval.' },
        { status: 400 }
      )
    }

    // 7. Determine Project Type
    const projectType = resolveProjectType(proposal.title, proposal.purpose)

    // 8. Execute atomic conversion inside prisma.$transaction
    const result = await prisma.$transaction(async (tx) => {
      // a. Create Project
      const project = await tx.project.create({
        data: {
          name: proposal.title,
          projectType,
          stateId: stateId!,
          districtId: districtId!,
          status: 'IN_PROGRESS',
          totalAreaHectares: new Prisma.Decimal(proposal.landArea),
          estimatedCost: new Prisma.Decimal(proposal.estimatedCost),
          createdBy: approverUserId,
          proposalId: proposal.id,
        },
      })

      // b. Create WorkflowInstance linked to that new Project at stage SIA
      const workflow = await tx.workflowInstance.create({
        data: {
          projectId: project.id,
          currentStage: WorkflowStage.SIA,
          status: WorkflowStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      })

      // c. Update Proposal status to "converted"
      await tx.proposal.update({
        where: { id: proposal.id },
        data: {
          status: 'converted',
        },
      })

      // d. Create AuditLog row
      await tx.auditLog.create({
        data: {
          userId: approverUserId,
          action: 'PROPOSAL_CONVERTED_TO_PROJECT',
          entityType: 'Proposal',
          entityId: proposal.id,
        },
      })

      return { project, workflow }
    })

    // 9. Return HTTP 201
    return NextResponse.json(
      {
        success: true,
        message: 'Proposal approved and converted to a project at the SIA stage.',
        proposalId: proposal.id,
        project: {
          id: result.project.id,
          name: result.project.name,
          status: result.project.status,
          workflow: {
            currentStage: result.workflow.currentStage,
            status: result.workflow.status,
          },
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error approving and converting proposal:', error)
    return NextResponse.json(
      { error: 'Internal server error while approving proposal' },
      { status: 500 }
    )
  }
}

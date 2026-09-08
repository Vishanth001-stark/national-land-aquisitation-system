import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ProjectType, WorkflowStage, WorkflowStatus, Prisma } from '@prisma/client'
import { z } from 'zod'

const financialSanctionSchema = z.object({
  sanctionOrderNo: z.string().min(2).max(100),
  sanctionedAmountCr: z.number().positive(),
  landAcquisitionBudgetCr: z.number().positive(),
  civilWorksBudgetCr: z.number().positive(),
  sanctioningAuthority: z.string().min(2).max(100),
  sanctionDate: z.string(),
  stateId: z.string().nullable().optional(),
  districtId: z.string().nullable().optional(),
  documentHash: z.string().nullable().optional(),
})

export async function POST(
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

    // Retrieve proposal with its clearances, alignments, state, and district
    const proposal = await prisma.projectProposal.findUnique({
      where: { id: proposalId },
      include: {
        clearances: true,
        alignments: true,
        state: true,
        district: true,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    // Check if it's already sanctioned
    if (proposal.status === 'AA_FS_SANCTIONED') {
      return NextResponse.json({ error: 'Proposal is already sanctioned with active AA&FS order.' }, { status: 409 })
    }

    const body = await request.json()
    const parsed = financialSanctionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const {
      sanctionOrderNo,
      sanctionedAmountCr,
      landAcquisitionBudgetCr,
      civilWorksBudgetCr,
      sanctioningAuthority,
      sanctionDate,
      stateId,
      districtId,
      documentHash,
    } = parsed.data

    // GATEKEEPER 1: Preferred Corridor Alignment must be locked
    const preferredAlignment = proposal.alignments.find((a) => a.isPreferred)
    if (!preferredAlignment) {
      return NextResponse.json(
        { error: 'Alignment Gate Block: A preferred corridor alignment must be selected and locked before financial sanction.' },
        { status: 400 }
      )
    }

    // GATEKEEPER 2: In-Principle Clearances Vetted
    const approvedClearances = proposal.clearances.filter((c) => c.status === 'APPROVED')
    if (approvedClearances.length === 0) {
      return NextResponse.json(
        {
          error: 'Statutory Clearance Gate Block: In-Principle Statutory Approvals (Forest Stage-1 / EIA ToR / Railway NOC) must be approved before financial sanction. Please use the Fast-Track In-Principle Clearances action or update individual milestones.',
        },
        { status: 400 }
      )
    }

    // Dynamically resolve target City / District and State for Project Creation
    let targetDistrictId = districtId || proposal.districtId
    let targetStateId = stateId || proposal.stateId

    let resolvedDistrict = null
    if (targetDistrictId) {
      resolvedDistrict = await prisma.district.findUnique({
        where: { id: targetDistrictId },
        include: { state: true },
      })
    }

    if (!resolvedDistrict) {
      resolvedDistrict = await prisma.district.findFirst({
        include: { state: true },
        orderBy: { createdAt: 'asc' },
      })
    }

    if (!resolvedDistrict) {
      return NextResponse.json(
        { error: 'System Configuration Error: No state or district configured in the database to link the project.' },
        { status: 500 }
      )
    }

    const finalDistrictId = resolvedDistrict.id
    const finalStateId = targetStateId || resolvedDistrict.stateId

    // Resolve project type enum from category or title
    let pType: ProjectType = ProjectType.highway
    const combined = `${proposal.title} ${proposal.category}`.toLowerCase()
    if (combined.includes('rail')) {
      pType = ProjectType.railway
    } else if (combined.includes('water') || combined.includes('irrigation')) {
      pType = ProjectType.irrigation
    } else if (combined.includes('industrial')) {
      pType = ProjectType.industrial_corridor
    } else if (combined.includes('energy') || combined.includes('solar')) {
      pType = ProjectType.renewable_energy
    }

    // Calculate approximate area in hectares from corridor alignment
    const corridorLengthKm = preferredAlignment.totalLengthKm ? Number(preferredAlignment.totalLengthKm) : 25
    const bufferWidthM = preferredAlignment.bufferWidthMeters || 60
    const calculatedAreaHa = Math.round((corridorLengthKm * 1000 * bufferWidthM * 2) / 10000)

    // Execute transaction: Record Sanction + Create Project + Initialize Workflow at Stage SIA + Link Project to Proposal
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Financial Sanction Order Record
      const sanction = await tx.financialSanction.create({
        data: {
          proposalId,
          sanctionOrderNo,
          sanctionedAmountCr,
          landAcquisitionBudgetCr,
          civilWorksBudgetCr,
          sanctioningAuthority,
          sanctionDate: new Date(sanctionDate),
          documentHash: documentHash || null,
        },
      })

      // 2. Initialize Downstream Land Acquisition Project with user's selected City/District and State
      const project = await tx.project.create({
        data: {
          name: proposal.title,
          projectType: pType,
          stateId: finalStateId,
          districtId: finalDistrictId,
          status: 'IN_PROGRESS',
          totalAreaHectares: new Prisma.Decimal(calculatedAreaHa || 120),
          estimatedCost: new Prisma.Decimal(sanctionedAmountCr),
          createdBy: session.user.id,
        },
      })

      // 3. Update Proposal: mark sanctioned and link downstream projectId, stateId, and districtId
      const updatedProposal = await tx.projectProposal.update({
        where: { id: proposalId },
        data: {
          status: 'AA_FS_SANCTIONED',
          projectId: project.id,
          stateId: finalStateId,
          districtId: finalDistrictId,
        },
      })

      // 4. Initialize Workflow Instance at Stage 1: SIA (Social Impact Assessment - Sec 4 RFCTLARR)
      const siaDeadline = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 180 days statutory window
      const workflow = await tx.workflowInstance.create({
        data: {
          projectId: project.id,
          currentStage: WorkflowStage.SIA,
          status: WorkflowStatus.IN_PROGRESS,
          startedAt: new Date(),
          slaDeadline: siaDeadline,
        },
      })

      // 5. Create Audit Log Entry
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: `PROPOSAL_SANCTIONED_AND_PROJECT_INITIALIZED:${proposal.proposalCode} -> PROJECT:${project.id}`,
          entityType: 'ProjectProposal',
          entityId: proposalId,
        },
      })

      return { sanction, updatedProposal, project, workflow }
    })

    return NextResponse.json({
      success: true,
      message: 'AA&FS Financial Sanction registered and Project initialized at SIA stage under RFCTLARR Act.',
      proposalId: result.updatedProposal.id,
      proposalStatus: result.updatedProposal.status,
      sanctionId: result.sanction.id,
      projectId: result.project.id,
      project: {
        id: result.project.id,
        name: result.project.name,
        currentStage: result.workflow.currentStage,
        totalAreaHectares: result.project.totalAreaHectares,
        estimatedCost: result.project.estimatedCost,
      },
    })
  } catch (error) {
    console.error('Error creating financial sanction:', error)
    return NextResponse.json(
      { error: 'Internal server error processing financial sanction' },
      { status: 500 }
    )
  }
}

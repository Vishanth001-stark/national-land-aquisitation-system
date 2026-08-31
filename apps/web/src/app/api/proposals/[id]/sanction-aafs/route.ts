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

    // Retrieve proposal with its clearances and alignments
    const proposal = await prisma.projectProposal.findUnique({
      where: { id: proposalId },
      include: {
        clearances: true,
        alignments: true,
      },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
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
      documentHash,
    } = parsed.data

    // GATEKEEPER 1: Verify all mandatory clearances are APPROVED
    const totalClearances = proposal.clearances.length
    const approvedClearances = proposal.clearances.filter((c) => c.status === 'APPROVED').length

    if (approvedClearances < totalClearances) {
      return NextResponse.json(
        {
          error: `Clearance Gate Block: All ${totalClearances} mandatory clearances must be approved before financial sanction. Currently approved: ${approvedClearances}/${totalClearances}.`,
        },
        { status: 400 }
      )
    }

    // GATEKEEPER 2: Verify a preferred alignment has been selected
    const preferredAlignment = proposal.alignments.find((a) => a.isPreferred)
    if (!preferredAlignment) {
      return NextResponse.json(
        { error: 'Alignment Gate Block: A preferred corridor alignment must be selected and locked before financial sanction.' },
        { status: 400 }
      )
    }

    // Check if it's already sanctioned
    if (proposal.status === 'AA_FS_SANCTIONED') {
      return NextResponse.json({ error: 'Proposal is already sanctioned' }, { status: 409 })
    }

    // Fetch fallback district and state for Project Creation
    const fallbackDistrict = await prisma.district.findFirst({
      include: { state: true },
      orderBy: { createdAt: 'asc' },
    })

    if (!fallbackDistrict) {
      return NextResponse.json(
        { error: 'System Configuration Error: No state or district configured in the database to link the project.' },
        { status: 500 }
      )
    }

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

    // Execute transaction: Record Sanction + Transition Proposal + Replicate as Project for downstream LA
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Financial Sanction
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

      // 2. Update Proposal Status
      const updatedProposal = await tx.projectProposal.update({
        where: { id: proposalId },
        data: { status: 'AA_FS_SANCTIONED' },
      })

      // 3. Create Project in Downstream Land Acquisition module
      const project = await tx.project.create({
        data: {
          name: proposal.title,
          projectType: pType,
          stateId: fallbackDistrict.stateId,
          districtId: fallbackDistrict.id,
          status: 'IN_PROGRESS',
          totalAreaHectares: preferredAlignment.totalLengthKm ? new Prisma.Decimal(Number(preferredAlignment.totalLengthKm) * 6) : new Prisma.Decimal(100), // Approximate area estimate (length * width buffer)
          estimatedCost: new Prisma.Decimal(sanctionedAmountCr),
          createdBy: session.user.id,
          // We can link it to the simple proposal or other fields if needed, but since Project is linked to Proposal model, let's keep it null or referential.
        },
      })

      // 4. Create Workflow Instance at Stage SIA
      const workflow = await tx.workflowInstance.create({
        data: {
          projectId: project.id,
          currentStage: WorkflowStage.SIA,
          status: WorkflowStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      })

      // 5. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: `PROPOSAL_SANCTIONED_AND_PROJECT_INITIALIZED:${proposal.proposalCode}`,
          entityType: 'ProjectProposal',
          entityId: proposalId,
        },
      })

      return { sanction, updatedProposal, project, workflow }
    })

    return NextResponse.json({
      success: true,
      message: 'AA&FS Financial Sanction registered and Project initialized at SIA stage.',
      proposalId: result.updatedProposal.id,
      proposalStatus: result.updatedProposal.status,
      sanctionId: result.sanction.id,
      projectId: result.project.id,
    })
  } catch (error) {
    console.error('Error creating financial sanction:', error)
    return NextResponse.json(
      { error: 'Internal server error processing financial sanction' },
      { status: 500 }
    )
  }
}

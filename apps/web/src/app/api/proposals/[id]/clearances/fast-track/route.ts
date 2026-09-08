import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    const proposal = await prisma.projectProposal.findUnique({
      where: { id: proposalId },
      include: { clearances: true },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const now = new Date()
    const code = proposal.proposalCode

    // In-principle statutory approvals required for AA&FS under Indian Pre-Construction Framework
    const inPrincipleMap: Record<string, { ref: string; remarks: string }> = {
      FOREST_STAGE_1: {
        ref: `MOEFCC-ST1-REC/${code}`,
        remarks: 'Stage-1 In-Principle approval granted by MoEFCC Regional Empowered Committee',
      },
      EIA_TOR: {
        ref: `EIA-TOR-SEAC/${code}`,
        remarks: 'Terms of Reference & Environmental Baseline Scoping approved',
      },
      EIA_PUBLIC_HEARING: {
        ref: `EIA-PH-PCB/${code}`,
        remarks: 'Public consultation summary and EMP provisions vetted',
      },
      RAILWAY_NOC: {
        ref: `RLY-NOC-CR/${code}`,
        remarks: 'Alignment span and Level Crossing clearance vetted by Railway Zone',
      },
      UTILITY_PWD: {
        ref: `PWD-UTL-ROW/${code}`,
        remarks: 'State PWD Right-of-Way & high-tension utility relocation approved',
      },
    }

    // Execute in transaction: batch approve clearances and update proposal status
    const result = await prisma.$transaction(async (tx) => {
      for (const clearance of proposal.clearances) {
        const standardDetails = inPrincipleMap[clearance.clearanceType] || {
          ref: `NOC-${clearance.clearanceType}-${code}`,
          remarks: 'Statutory vetting requirement satisfied for PIB Review',
        }

        await tx.statutoryClearance.update({
          where: { id: clearance.id },
          data: {
            status: 'APPROVED',
            referenceNo: clearance.referenceNo || standardDetails.ref,
            remarks: clearance.remarks || standardDetails.remarks,
            submittedDate: clearance.submittedDate || now,
            approvalDate: now,
          },
        })
      }

      // Advance proposal status to PIB Review
      const updatedProposal = await tx.projectProposal.update({
        where: { id: proposalId },
        data: {
          status: 'PIB_SANCTION_REVIEW',
        },
      })

      // Fetch refreshed clearances
      const updatedClearances = await tx.statutoryClearance.findMany({
        where: { proposalId },
        orderBy: { clearanceType: 'asc' },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: `STATUTORY_CLEARANCES_FAST_TRACKED:${code}`,
          entityType: 'ProjectProposal',
          entityId: proposalId,
        },
      })

      return { proposal: updatedProposal, clearances: updatedClearances }
    })

    return NextResponse.json({
      success: true,
      message: 'Statutory clearances fast-tracked and in-principle approvals recorded.',
      proposal: result.proposal,
      clearances: result.clearances,
    })
  } catch (error) {
    console.error('Error fast-tracking statutory clearances:', error)
    return NextResponse.json(
      { error: 'Internal server error fast-tracking clearances' },
      { status: 500 }
    )
  }
}

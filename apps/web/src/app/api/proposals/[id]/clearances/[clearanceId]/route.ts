import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateClearanceSchema = z.object({
  status: z.enum(['NOT_APPLIED', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED']),
  referenceNo: z.string().nullable().optional(),
  submittedDate: z.string().nullable().optional(),
  approvalDate: z.string().nullable().optional(),
  remarks: z.string().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; clearanceId: string }> | { id: string; clearanceId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await context.params
    const proposalId = resolvedParams?.id
    const clearanceId = resolvedParams?.clearanceId

    if (!proposalId || !clearanceId) {
      return NextResponse.json({ error: 'Proposal ID and Clearance ID are required' }, { status: 400 })
    }

    // Verify clearance exists and belongs to the proposal
    const clearance = await prisma.statutoryClearance.findUnique({
      where: { id: clearanceId },
    })

    if (!clearance || clearance.proposalId !== proposalId) {
      return NextResponse.json(
        { error: 'Clearance record not found or does not belong to this proposal' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const parsed = updateClearanceSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { status, referenceNo, submittedDate, approvalDate, remarks } = parsed.data

    // Update clearance and compute proposal status transition in a transaction
    const updatedClearance = await prisma.$transaction(async (tx) => {
      const c = await tx.statutoryClearance.update({
        where: { id: clearanceId },
        data: {
          status,
          referenceNo: referenceNo !== undefined ? referenceNo : undefined,
          submittedDate: submittedDate ? new Date(submittedDate) : referenceNo === null ? null : undefined,
          approvalDate: approvalDate ? new Date(approvalDate) : referenceNo === null ? null : undefined,
          remarks: remarks !== undefined ? remarks : undefined,
        },
      })

      // Fetch all clearances to check if we can transition proposal status
      const allClearances = await tx.statutoryClearance.findMany({
        where: { proposalId },
      })

      const proposal = await tx.projectProposal.findUnique({
        where: { id: proposalId },
      })

      if (proposal) {
        let newStatus = proposal.status

        const totalClearances = allClearances.length
        const approvedCount = allClearances.filter((cl) => cl.status === 'APPROVED').length
        const pendingOrInReviewCount = allClearances.filter((cl) => cl.status === 'SUBMITTED' || cl.status === 'IN_REVIEW').length

        if (approvedCount === totalClearances && totalClearances > 0) {
          // All clearances are approved -> Move to PIB Sanction Review
          newStatus = 'PIB_SANCTION_REVIEW'
        } else if (pendingOrInReviewCount > 0 && (proposal.status === 'PRE_FEASIBILITY_APPROVED' || proposal.status === 'DPR_UNDER_PREPARATION' || proposal.status === 'PROPOSAL_DRAFT')) {
          // Clearances have been applied/submitted -> Move to CLEARANCE_PENDING
          newStatus = 'CLEARANCE_PENDING'
        }

        if (newStatus !== proposal.status) {
          await tx.projectProposal.update({
            where: { id: proposalId },
            data: { status: newStatus },
          })
        }
      }

      return c
    })

    return NextResponse.json({
      success: true,
      clearance: updatedClearance,
    })
  } catch (error) {
    console.error('Error updating clearance:', error)
    return NextResponse.json(
      { error: 'Internal server error updating clearance milestone' },
      { status: 500 }
    )
  }
}

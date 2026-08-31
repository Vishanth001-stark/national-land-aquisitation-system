import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; alignmentId: string }> | { id: string; alignmentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await context.params
    const proposalId = resolvedParams?.id
    const alignmentId = resolvedParams?.alignmentId

    if (!proposalId || !alignmentId) {
      return NextResponse.json({ error: 'Proposal ID and Alignment ID are required' }, { status: 400 })
    }

    // Verify alignment belongs to proposal
    const alignment = await prisma.proposalAlignment.findUnique({
      where: { id: alignmentId },
    })

    if (!alignment || alignment.proposalId !== proposalId) {
      return NextResponse.json(
        { error: 'Alignment not found or does not belong to this proposal' },
        { status: 404 }
      )
    }

    // Update in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Unset any other preferred alignment for this proposal
      await tx.proposalAlignment.updateMany({
        where: { proposalId },
        data: { isPreferred: false },
      })

      // 2. Set this alignment as preferred
      await tx.proposalAlignment.update({
        where: { id: alignmentId },
        data: { isPreferred: true },
      })

      // 3. If proposal is in DRAFT, transition to PRE_FEASIBILITY_APPROVED
      const proposal = await tx.projectProposal.findUnique({
        where: { id: proposalId },
      })

      if (proposal && proposal.status === 'PROPOSAL_DRAFT') {
        await tx.projectProposal.update({
          where: { id: proposalId },
          data: { status: 'PRE_FEASIBILITY_APPROVED' },
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: `Alignment locked as preferred. Proposal state updated.`,
      alignmentId,
    })
  } catch (error) {
    console.error('Error selecting alignment:', error)
    return NextResponse.json(
      { error: 'Internal server error locking preferred alignment' },
      { status: 500 }
    )
  }
}

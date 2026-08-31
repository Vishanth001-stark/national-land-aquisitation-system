import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
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

    // Fetch clearances checklist for this proposal
    const clearances = await prisma.statutoryClearance.findMany({
      where: { proposalId },
      orderBy: { clearanceType: 'asc' },
    })

    return NextResponse.json(clearances)
  } catch (error) {
    console.error('Error fetching clearances:', error)
    return NextResponse.json(
      { error: 'Internal server error loading clearances checklist' },
      { status: 500 }
    )
  }
}

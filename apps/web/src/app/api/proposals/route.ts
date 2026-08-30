import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, landArea, location, estimatedCost, purpose } = body

    // Validate required fields
    if (!title || !description || !landArea || !location || !estimatedCost) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create proposal
    const proposal = await prisma.proposal.create({
      data: {
        title,
        description,
        landArea: parseFloat(landArea),
        location,
        estimatedCost: parseFloat(estimatedCost),
        purpose,
        submittedBy: session.user.id,
        status: 'draft',
      },
    })

    return NextResponse.json(proposal, { status: 201 })
  } catch (error) {
    console.error('Error creating proposal:', error)
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If CENTRAL_MINISTRY or SYSTEM_ADMIN, allow viewing all proposals; otherwise view user's own
    const isAdmin =
      session.user.role === 'CENTRAL_MINISTRY' ||
      session.user.role === 'SYSTEM_ADMIN'

    const proposals = await prisma.proposal.findMany({
      where: isAdmin ? undefined : { submittedBy: session.user.id },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        submittedByUser: {
          select: {
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json(proposals)
  } catch (error) {
    console.error('Error fetching proposals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    )
  }
}
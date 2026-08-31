import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import { z } from 'zod'

const createProposalSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  landArea: z.number().positive('Land area must be a positive number'),
  location: z.string().min(2, 'Location is required').max(500),
  estimatedCost: z.number().positive('Estimated cost must be a positive number'),
  purpose: z.string().min(3, 'Purpose is required').max(500),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createProposalSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { title, description, landArea, location, estimatedCost, purpose } = parsed.data

    const proposal = await prisma.proposal.create({
      data: {
        title,
        description,
        landArea,
        location,
        estimatedCost,
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    const isAdmin =
      session.user.role === ROLES.CENTRAL_MINISTRY ||
      session.user.role === ROLES.SYSTEM_ADMIN ||
      session.user.role === ROLES.STATE_NODAL

    const where = isAdmin ? {} : { submittedBy: session.user.id }

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          submittedByUser: {
            select: { name: true, email: true },
          },
          project: {
            select: { id: true, name: true, status: true },
          },
        },
      }),
      prisma.proposal.count({ where }),
    ])

    return NextResponse.json({
      data: proposals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching proposals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    )
  }
}
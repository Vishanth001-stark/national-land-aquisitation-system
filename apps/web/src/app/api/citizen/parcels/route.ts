import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'

export async function GET() {
  try {
    // 1. Authenticate caller
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Authorize caller: CITIZEN or SYSTEM_ADMIN
    const userRole = session.user.role
    if (userRole !== ROLES.CITIZEN && userRole !== ROLES.SYSTEM_ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden: Access restricted to citizens' },
        { status: 403 }
      )
    }

    // 3. Resolve citizen user ID
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
        { error: 'Citizen user account could not be resolved' },
        { status: 401 }
      )
    }

    // 4. Query ONLY land parcels owned by this authenticated citizen
    const parcels = await prisma.landParcel.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        project: {
          include: {
            state: {
              select: { name: true, code: true },
            },
            district: {
              select: { name: true },
            },
            workflowInstances: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    return NextResponse.json(parcels)
  } catch (error) {
    console.error('Error fetching citizen land parcels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch citizen land records' },
      { status: 500 }
    )
  }
}

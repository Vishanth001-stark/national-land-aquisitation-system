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

    // 2. Role Enforcement: CENTRAL_MINISTRY or SYSTEM_ADMIN only
    const userRole = session.user.role
    if (
      userRole !== ROLES.CENTRAL_MINISTRY &&
      userRole !== ROLES.SYSTEM_ADMIN
    ) {
      return NextResponse.json(
        { error: 'Forbidden: Access restricted to authorized Central Ministry or System Admin officers' },
        { status: 403 }
      )
    }

    // 3. Fetch candidate cadastral parcels
    const parcels = await prisma.landParcel.findMany({
      where: {
        isCandidate: true,
      },
      orderBy: {
        surveyNumber: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      parcels,
    })
  } catch (error) {
    console.error('Error fetching cadastral parcels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch candidate cadastral land parcels' },
      { status: 500 }
    )
  }
}

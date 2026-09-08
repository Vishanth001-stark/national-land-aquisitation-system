import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate caller
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized: Please log in or create a citizen account first' }, { status: 401 })
    }

    const body = await request.json()
    const { code } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Valid invitation code is required' },
        { status: 400 }
      )
    }

    const cleanCode = code.trim().toUpperCase()

    // 2. Find invitation
    const invitation = await prisma.invitation.findUnique({
      where: { code: cleanCode },
      include: {
        landParcel: {
          include: {
            project: true,
          },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation code. Please check your invitation code and try again.' },
        { status: 404 }
      )
    }

    if (invitation.status === 'ACTIVATED') {
      return NextResponse.json(
        { error: 'This invitation code has already been activated.' },
        { status: 400 }
      )
    }

    if (new Date() > invitation.expiresAt) {
      // Mark as expired
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json(
        { error: 'This invitation code has expired. Please contact the Central Ministry / District Collectorate.' },
        { status: 400 }
      )
    }

    // Resolve user ID
    let userId = session.user.id
    if (!userId && session.user.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      if (dbUser) userId = dbUser.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'User session invalid' }, { status: 401 })
    }

    // 3. Link parcel to this citizen account & mark invitation ACTIVATED
    await prisma.$transaction(async (tx) => {
      // Update land parcel ownerId
      await tx.landParcel.update({
        where: { id: invitation.landParcelId },
        data: {
          ownerId: userId,
          ownerName: session.user.name || invitation.ownerName,
        },
      })

      // Mark invitation activated
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACTIVATED',
        },
      })

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: `ACTIVATED_CITIZEN_PORTAL: Linked parcel ${invitation.landParcel.surveyNumber} for project ${invitation.landParcel.project?.name}`,
          entityType: 'LandParcel',
          entityId: invitation.landParcelId,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: `Portal account successfully activated! Your land parcel (${invitation.landParcel.surveyNumber}) is now linked to your Citizen Dashboard.`,
      parcel: invitation.landParcel,
    })
  } catch (error) {
    console.error('Error activating citizen invitation code:', error)
    return NextResponse.json(
      { error: 'Failed to activate citizen portal invitation' },
      { status: 500 }
    )
  }
}

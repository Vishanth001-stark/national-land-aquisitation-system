import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ROLES } from '@/lib/roles'
import crypto from 'crypto'

function generateInvitationCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let code = 'INV-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
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

    const resolvedParams = await context.params
    const projectId = resolvedParams?.id
    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // 3. Find project and its confirmed parcels
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        landParcels: {
          include: {
            invitations: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (!project.landParcels || project.landParcels.length === 0) {
      return NextResponse.json(
        { error: 'No land parcels have been confirmed for this project yet.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days expiration

    // 4. Generate invitations for each parcel
    const invitationPreviews = []

    for (const parcel of project.landParcels) {
      // Check if active pending invitation exists
      let invitation = parcel.invitations[0]

      if (!invitation || invitation.status === 'EXPIRED') {
        const code = generateInvitationCode()
        invitation = await prisma.invitation.create({
          data: {
            code,
            landParcelId: parcel.id,
            ownerName: parcel.ownerName || 'Landowner',
            status: 'PENDING',
            expiresAt,
            createdById: session.user.id,
          },
        })
      }

      invitationPreviews.push({
        invitationId: invitation.id,
        parcelId: parcel.id,
        surveyNumber: parcel.surveyNumber || 'N/A',
        ownerName: parcel.ownerName || 'Landowner',
        areaHectares: parcel.areaHectares,
        compensationAmount: parcel.compensationAmount,
        invitationCode: invitation.code,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        deliveryStatus: 'Notification prepared for delivery',
        honestyNotice:
          'Demo parcel data • Notification prepared for delivery (Production: integrate authorized state land-record and approved notification services).',
      })
    }

    // Create Audit Log entry
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `GENERATED_CITIZEN_INVITATIONS: ${invitationPreviews.length} activation codes generated`,
        entityType: 'Project',
        entityId: project.id,
      },
    })

    return NextResponse.json({
      success: true,
      projectName: project.name,
      totalInvitations: invitationPreviews.length,
      invitationPreviews,
    })
  } catch (error) {
    console.error('Error generating citizen invitations:', error)
    return NextResponse.json(
      { error: 'Failed to generate citizen portal activation invitations' },
      { status: 500 }
    )
  }
}

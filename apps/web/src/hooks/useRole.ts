'use client'

import { useSession } from 'next-auth/react'

const roleHierarchy = {
  SYSTEM_ADMIN: 10,
  CENTRAL_MINISTRY: 9,
  STATE_NODAL: 8,
  DISTRICT_COLLECTOR: 7,
  LAND_ACQUIRING_BODY: 6,
  LAND_REVENUE_OFFICER: 5,
  TEHSILDAR: 4,
  RR_OFFICER: 3,
  FINANCE_OFFICER: 2,
  CITIZEN: 1,
}

export function useRole() {
  const { data: session } = useSession()
  const userRole = session?.user?.role as keyof typeof roleHierarchy

  const hasRole = (allowedRoles: string[]) => {
    if (!userRole) return false
    const userLevel = roleHierarchy[userRole] || 0
    return allowedRoles.some(role => {
      const allowedLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 0
      return userLevel >= allowedLevel
    })
  }

  return {
    role: userRole,
    hasRole,
    isAuthenticated: !!session,
  }
}

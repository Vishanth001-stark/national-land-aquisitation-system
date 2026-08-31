'use client'

import { useSession } from 'next-auth/react'

// Role hierarchy — for display/ordering purposes ONLY.
// Do NOT use this for authorization checks (use hasRole with exact match).
export const roleHierarchy = {
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
  const userRole = session?.user?.role as keyof typeof roleHierarchy | undefined

  /**
   * Returns true if the current user's role is in the allowedRoles list.
   * Uses EXACT matching — higher roles do NOT automatically pass lower role checks.
   * Use this for all authorization guards.
   */
  const hasRole = (allowedRoles: string[]): boolean => {
    if (!userRole) return false
    return allowedRoles.includes(userRole)
  }

  /**
   * Returns true if the current user's role is at or above the given role in hierarchy.
   * Use this ONLY for display logic, never for access control.
   */
  const isAtLeastRole = (minRole: keyof typeof roleHierarchy): boolean => {
    if (!userRole) return false
    return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[minRole] ?? 0)
  }

  return {
    role: userRole,
    hasRole,
    isAtLeastRole,
    isAuthenticated: !!session,
  }
}


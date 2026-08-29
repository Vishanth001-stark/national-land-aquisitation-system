export const ROLES = {
  CENTRAL_MINISTRY: 'CENTRAL_MINISTRY',
  STATE_NODAL: 'STATE_NODAL',
  DISTRICT_COLLECTOR: 'DISTRICT_COLLECTOR',
  LAND_ACQUIRING_BODY: 'LAND_ACQUIRING_BODY',
  LAND_REVENUE_OFFICER: 'LAND_REVENUE_OFFICER',
  TEHSILDAR: 'TEHSILDAR',
  RR_OFFICER: 'RR_OFFICER',
  FINANCE_OFFICER: 'FINANCE_OFFICER',
  CITIZEN: 'CITIZEN',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

export const rolePermissions = {
  [ROLES.CENTRAL_MINISTRY]: {
    canViewNationalDashboard: true,
    canViewAllProjects: true,
    canApproveAwards: false,
    canDisburseCompensation: false,
  },
  [ROLES.DISTRICT_COLLECTOR]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canApproveAwards: true,
    canDisburseCompensation: false,
  },
  [ROLES.CITIZEN]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canApproveAwards: false,
    canDisburseCompensation: false,
  },
} as const


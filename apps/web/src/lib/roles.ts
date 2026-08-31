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

export const rolePermissions: Record<Role, {
  canViewNationalDashboard: boolean
  canViewAllProjects: boolean
  canViewAllProposals: boolean
  canApproveProposals: boolean
  canAdvanceWorkflow: boolean
  canApproveAwards: boolean
  canDisburseCompensation: boolean
  canManageUsers: boolean
  canViewOwnParcels: boolean
}> = {
  [ROLES.CENTRAL_MINISTRY]: {
    canViewNationalDashboard: true,
    canViewAllProjects: true,
    canViewAllProposals: true,
    canApproveProposals: true,
    canAdvanceWorkflow: true,
    canApproveAwards: false,
    canDisburseCompensation: false,
    canManageUsers: false,
    canViewOwnParcels: false,
  },
  [ROLES.STATE_NODAL]: {
    canViewNationalDashboard: false,
    canViewAllProjects: true,
    canViewAllProposals: true,
    canApproveProposals: false,
    canAdvanceWorkflow: false,
    canApproveAwards: false,
    canDisburseCompensation: false,
    canManageUsers: false,
    canViewOwnParcels: false,
  },
  [ROLES.DISTRICT_COLLECTOR]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canViewAllProposals: false,
    canApproveProposals: false,
    canAdvanceWorkflow: false,
    canApproveAwards: true,
    canDisburseCompensation: false,
    canManageUsers: false,
    canViewOwnParcels: false,
  },
  [ROLES.LAND_ACQUIRING_BODY]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canViewAllProposals: false,
    canApproveProposals: false,
    canAdvanceWorkflow: false,
    canApproveAwards: false,
    canDisburseCompensation: false,
    canManageUsers: false,
    canViewOwnParcels: false,
  },
  [ROLES.LAND_REVENUE_OFFICER]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canViewAllProposals: false,
    canApproveProposals: false,
    canAdvanceWorkflow: false,
    canApproveAwards: false,
    canDisburseCompensation: false,
    canManageUsers: false,
    canViewOwnParcels: false,
  },
  [ROLES.TEHSILDAR]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canViewAllProposals: false,
    canApproveProposals: false,
    canAdvanceWorkflow: false,
    canApproveAwards: false,
    canDisburseCompensation: false,
    canManageUsers: false,
    canViewOwnParcels: false,
  },
  [ROLES.RR_OFFICER]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canViewAllProposals: false,
    canApproveProposals: false,
    canAdvanceWorkflow: false,
    canApproveAwards: false,
    canDisburseCompensation: false,
    canManageUsers: false,
    canViewOwnParcels: false,
  },
  [ROLES.FINANCE_OFFICER]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canViewAllProposals: false,
    canApproveProposals: false,
    canAdvanceWorkflow: false,
    canApproveAwards: false,
    canDisburseCompensation: true,
    canManageUsers: false,
    canViewOwnParcels: false,
  },
  [ROLES.CITIZEN]: {
    canViewNationalDashboard: false,
    canViewAllProjects: false,
    canViewAllProposals: false,
    canApproveProposals: false,
    canAdvanceWorkflow: false,
    canApproveAwards: false,
    canDisburseCompensation: false,
    canManageUsers: false,
    canViewOwnParcels: true,
  },
  [ROLES.SYSTEM_ADMIN]: {
    canViewNationalDashboard: true,
    canViewAllProjects: true,
    canViewAllProposals: true,
    canApproveProposals: true,
    canAdvanceWorkflow: true,
    canApproveAwards: true,
    canDisburseCompensation: true,
    canManageUsers: true,
    canViewOwnParcels: false,
  },
} as const

export function hasPermission(
  role: Role,
  permission: keyof typeof rolePermissions[Role]
): boolean {
  return rolePermissions[role]?.[permission] ?? false
}

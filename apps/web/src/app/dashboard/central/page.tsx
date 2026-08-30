'use client'

import { useEffect, useState } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'
import Link from 'next/link'

interface DashboardStats {
  totalProjects: number
  totalProjectArea: number
  totalProjectCost: number
  activeProjects: number
  totalProposals: number
  totalLandArea: number
  totalEstimatedCost: number
  proposalsByStatus: Array<{
    status: string
    _count: {
      status: number
    }
  }>
  recentProposals: Array<{
    id: string
    title: string
    status: string
    landArea: number
    estimatedCost: number
    createdAt: string
    project?: {
      id: string
      name: string
    } | null
  }>
}

interface WorkflowInstance {
  id: string
  currentStage: string
  status: string
  createdAt: string
}

interface LandParcel {
  id: string
  surveyNumber?: string | null
  areaHectares?: number | null
}

interface ProjectItem {
  id: string
  name: string
  projectType: string
  status: string
  totalAreaHectares?: number | null
  state?: { name: string; code: string } | null
  district?: { name: string } | null
  workflowInstances: WorkflowInstance[]
  landParcels: LandParcel[]
}

const STAGE_LABELS: Record<string, string> = {
  SIA: '1. SIA',
  PRELIMINARY_NOTIFICATION: '2. Preliminary Notification',
  OBJECTIONS_CONSENT: '3. Objections & Consent',
  DECLARATION: '4. Declaration',
  AWARD: '5. Award',
  COMPENSATION: '6. Compensation',
  POSSESSION: '7. Possession (Final)',
}

export default function CentralDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadDashboardData = async () => {
    try {
      const [statsRes, projectsRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/projects'),
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        setProjects(projectsData)
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const handleAdvanceStage = async (projectId: string) => {
    setActionLoadingId(projectId)
    setActionMessage(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/advance`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setActionMessage({
          type: 'error',
          text: data.error || 'Failed to advance project stage',
        })
      } else {
        setActionMessage({
          type: 'success',
          text: data.message || `Advanced to ${data.currentStage}`,
        })
        // Refresh project list to reflect updated WorkflowInstance from server
        await loadDashboardData()
      }
    } catch (err) {
      console.error('Error advancing stage:', err)
      setActionMessage({
        type: 'error',
        text: 'Network error advancing project stage',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!window.confirm(`Are you sure you want to remove project "${projectName}"? This action cannot be undone.`)) {
      return
    }

    setActionLoadingId(`del-${projectId}`)
    setActionMessage(null)

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        setActionMessage({
          type: 'error',
          text: data.error || 'Failed to remove project',
        })
      } else {
        setActionMessage({
          type: 'success',
          text: data.message || `Project "${projectName}" removed successfully.`,
        })
        await loadDashboardData()
      }
    } catch (err) {
      console.error('Error removing project:', err)
      setActionMessage({
        type: 'error',
        text: 'Network error while removing project',
      })
    } finally {
      setActionLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <RoleGuard allowedRoles={[ROLES.CENTRAL_MINISTRY, ROLES.SYSTEM_ADMIN]}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">
            National Dashboard
          </h1>
          <Link
            href="/dashboard/proposals/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Proposal
          </Link>
        </div>

        {actionMessage && (
          <div
            className={`p-4 rounded-lg text-sm font-medium flex justify-between items-center ${
              actionMessage.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="ml-4 text-xs underline text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Projects</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats?.totalProjects ?? projects.length}</p>
            <span className="text-xs text-gray-400 mt-1 block">Acquisition projects</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Land Area</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {(stats?.totalProjectArea || 0).toFixed(2)} Ha
            </p>
            <span className="text-xs text-gray-400 mt-1 block">
              {((stats?.totalProjectArea || 0) * 2.47105).toFixed(2)} acres
            </span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Estimated Cost</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              ₹{((stats?.totalProjectCost || 0) / 10000000).toFixed(2)} Cr
            </p>
            <span className="text-xs text-gray-400 mt-1 block">Approved project budget</span>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700">Active Projects</h3>
            <p className="text-3xl font-bold text-orange-600 mt-2">
              {stats?.activeProjects ?? projects.filter(p => p.status === 'IN_PROGRESS').length}
            </p>
            <span className="text-xs text-gray-400 mt-1 block">In progress stage</span>
          </div>
        </div>

        {/* Projects Golden Path Advancement Section */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Land Acquisition Projects</h2>
              <p className="text-sm text-gray-500 mt-1">Track and advance projects through the 7-stage statutory workflow</p>
            </div>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
              {projects.length} Active Projects
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No land acquisition projects found. Seed the database to view projects.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project Name & Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Parcels
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Current Workflow Stage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {projects.map((project) => {
                    const currentInstance = project.workflowInstances[0]
                    const currentStage = currentInstance?.currentStage || 'Unknown'
                    const isPossession = currentStage === 'POSSESSION'
                    const isPending = actionLoadingId === project.id

                    return (
                      <tr key={project.id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{project.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{project.projectType.replace('_', ' ')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {project.district?.name ? `${project.district.name}, ` : ''}{project.state?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {project.landParcels?.length || 0} parcel(s)
                          {project.totalAreaHectares && (
                            <span className="text-xs text-gray-400 block">{project.totalAreaHectares} Ha</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                              isPossession
                                ? 'bg-green-100 text-green-800 border-green-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {STAGE_LABELS[currentStage] || currentStage}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-xs text-gray-600 font-mono">
                            {currentInstance?.status || project.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end items-center gap-2">
                            {isPossession ? (
                              <span className="text-xs px-3 py-1.5 bg-gray-100 text-gray-500 rounded-md border border-gray-200 cursor-not-allowed">
                                ✓ Completed
                              </span>
                            ) : (
                              <button
                                id={`advance-btn-${project.id}`}
                                onClick={() => handleAdvanceStage(project.id)}
                                disabled={isPending}
                                className={`px-3 py-1.5 text-xs font-medium rounded-md text-white shadow-sm transition ${
                                  isPending
                                    ? 'bg-blue-400 cursor-wait'
                                    : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                                }`}
                              >
                                {isPending ? 'Advancing...' : 'Advance Stage →'}
                              </button>
                            )}
                            <button
                              id={`delete-btn-${project.id}`}
                              onClick={() => handleDeleteProject(project.id, project.name)}
                              disabled={actionLoadingId === `del-${project.id}`}
                              title="Remove project"
                              className="px-2.5 py-1.5 text-xs font-medium rounded-md text-red-600 border border-red-200 hover:bg-red-50 active:bg-red-100 transition disabled:opacity-50"
                            >
                              {actionLoadingId === `del-${project.id}` ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/dashboard/proposals"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
              >
                <h3 className="font-semibold text-gray-900 mb-2">View Proposals</h3>
                <p className="text-sm text-gray-600">See all submitted proposals</p>
              </Link>
              <Link
                href="/dashboard/proposals/new"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
              >
                <h3 className="font-semibold text-gray-900 mb-2">Submit Proposal</h3>
                <p className="text-sm text-gray-600">Create new proposal</p>
              </Link>
              <Link
                href="/dashboard/projects"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
              >
                <h3 className="font-semibold text-gray-900 mb-2">View Projects</h3>
                <p className="text-sm text-gray-600">Manage ongoing projects</p>
              </Link>
              <Link
                href="/dashboard/map"
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 block"
              >
                <h3 className="font-semibold text-gray-900 mb-2">View Map</h3>
                <p className="text-sm text-gray-600">GIS map of land parcels</p>
              </Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Recent Proposals</h2>
              <Link
                href="/dashboard/proposals"
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
              >
                View all proposals →
              </Link>
            </div>
            {(() => {
              const pendingProposals = (stats?.recentProposals || []).filter(
                (p) => p.status !== 'converted' && !p.project
              )

              if (pendingProposals.length === 0) {
                return (
                  <p className="text-gray-500 text-sm py-4 text-center">
                    No pending proposals. All approved proposals have been converted to projects.
                  </p>
                )
              }

              return (
                <div className="space-y-3">
                  {pendingProposals.map((proposal) => {
                    const isApproving = actionLoadingId === `prop-${proposal.id}`

                    const handleApproveProposal = async () => {
                      setActionLoadingId(`prop-${proposal.id}`)
                      setActionMessage(null)
                      try {
                        const res = await fetch(`/api/proposals/${proposal.id}/approve`, {
                          method: 'POST',
                        })
                        const data = await res.json()
                        if (!res.ok) {
                          setActionMessage({
                            type: 'error',
                            text: data.error || 'Failed to convert proposal',
                          })
                        } else {
                          setActionMessage({
                            type: 'success',
                            text: data.message || 'Proposal converted to project successfully!',
                          })
                          await loadDashboardData()
                        }
                      } catch (err) {
                        console.error('Error approving proposal:', err)
                        setActionMessage({
                          type: 'error',
                          text: 'Network error approving proposal',
                        })
                      } finally {
                        setActionLoadingId(null)
                      }
                    }

                    return (
                      <div key={proposal.id} className="p-3.5 border border-gray-200 rounded-lg hover:border-gray-300 transition">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-gray-900 text-sm">{proposal.title}</h3>
                            <span className="text-xs text-gray-500">
                              {proposal.landArea} acres
                            </span>
                          </div>
                          <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-yellow-100 text-yellow-800">
                            {proposal.status}
                          </span>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-gray-100 flex justify-end items-center">
                          <button
                            id={`approve-recent-prop-${proposal.id}`}
                            onClick={handleApproveProposal}
                            disabled={isApproving}
                            className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            {isApproving ? 'Creating project...' : 'Approve & Create Project'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </RoleGuard>
  )
}

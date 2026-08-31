'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ROLES } from '@/lib/roles'

interface Proposal {
  id: string
  title: string
  description: string
  landArea: number
  location: string
  estimatedCost: number
  purpose: string
  status: string
  createdAt: string
  project?: {
    id: string
    name: string
    status: string
  } | null
}

interface ProjectProposal {
  id: string
  proposalCode: string
  title: string
  sponsoringMinistry: string
  category: string
  estimatedBudgetCr: number
  status: string
  createdAt: string
  alignments?: any[]
  clearances?: any[]
  financialSanction?: any
}

export default function ProposalsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'infra' ? 'infra' : 'citizen'

  const [activeTab, setActiveTab] = useState<'citizen' | 'infra'>(initialTab)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [infraProposals, setInfraProposals] = useState<ProjectProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; projectId?: string } | null>(null)

  const isCentralOrAdmin =
    session?.user?.role === ROLES.CENTRAL_MINISTRY ||
    session?.user?.role === ROLES.SYSTEM_ADMIN

  const fetchCitizenProposals = async () => {
    try {
      const res = await fetch('/api/proposals?type=citizen')
      if (res.ok) {
        const data = await res.json()
        setProposals(Array.isArray(data) ? data : data?.data || [])
      }
    } catch (err) {
      console.error('Error fetching citizen proposals:', err)
    }
  }

  const fetchInfraProposals = async () => {
    try {
      const res = await fetch('/api/proposals?type=infra')
      if (res.ok) {
        const data = await res.json()
        setInfraProposals(Array.isArray(data) ? data : data?.data || [])
      }
    } catch (err) {
      console.error('Error fetching infra proposals:', err)
    }
  }

  const loadData = async () => {
    setLoading(true)
    if (activeTab === 'citizen') {
      await fetchCitizenProposals()
    } else {
      await fetchInfraProposals()
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [activeTab])

  const handleApprove = async (proposalId: string) => {
    setApprovingId(proposalId)
    setMessage(null)

    try {
      const res = await fetch(`/api/proposals/${proposalId}/approve`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to approve proposal',
        })
      } else {
        setMessage({
          type: 'success',
          text: data.message || 'Proposal converted to project successfully!',
          projectId: data.project?.id,
        })
        await fetchCitizenProposals()
      }
    } catch (err) {
      console.error('Approval network error:', err)
      setMessage({
        type: 'error',
        text: 'Network error while converting proposal to project',
      })
    } finally {
      setApprovingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Project Proposals Portal
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Initiate and audit land acquisition schemes, feasibility layouts, and environmental clearance check dockets.
            </p>
          </div>
          <Link
            href="/dashboard/proposals/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-md transition"
          >
            + Create Proposal
          </Link>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-lg shadow-sm">
          <button
            onClick={() => setActiveTab('citizen')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
              activeTab === 'citizen'
                ? 'border-blue-600 text-blue-600 bg-blue-50/20'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            👤 Citizen Land Requests
          </button>
          <button
            onClick={() => setActiveTab('infra')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${
              activeTab === 'infra'
                ? 'border-blue-600 text-blue-600 bg-blue-50/20'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            🏗️ Infrastructure Pre-Sanctions
          </button>
        </div>

        {/* Success/Error messages banner */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg text-sm font-medium flex justify-between items-center ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div>
              <span>{message.text}</span>
              {message.projectId && (
                <Link
                  href="/dashboard/central"
                  className="ml-3 font-semibold underline text-green-900 hover:text-green-950"
                >
                  View in National Dashboard →
                </Link>
              )}
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-gray-500 hover:text-gray-700 ml-4 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
            Fetching proposal dockets...
          </div>
        ) : activeTab === 'citizen' ? (
          /* CITIZEN REQUESTS TABLE */
          proposals.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">No citizen land requests submitted yet.</p>
              <Link
                href="/dashboard/proposals/new"
                className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Create first request →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Land Area</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    {isCentralOrAdmin && (
                      <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {proposals.map((proposal) => {
                    const isConverted = proposal.status === 'converted' || Boolean(proposal.project)
                    const isApproving = approvingId === proposal.id

                    return (
                      <tr key={proposal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{proposal.title}</div>
                          <div className="text-xs text-gray-500 capitalize">{proposal.purpose}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{proposal.location}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{proposal.landArea} acres</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">₹{(proposal.estimatedCost / 10000000).toFixed(2)} Cr</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
                              isConverted
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : proposal.status === 'submitted'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-yellow-50 text-yellow-800 border-yellow-200'
                            }`}
                          >
                            {proposal.status}
                          </span>
                        </td>
                        {isCentralOrAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold">
                            {isConverted ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-md border border-green-200 text-xs font-semibold">
                                ✓ Converted to Project
                              </span>
                            ) : (
                              <button
                                onClick={() => handleApprove(proposal.id)}
                                disabled={isApproving}
                                className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-semibold shadow-sm transition disabled:opacity-50"
                              >
                                {isApproving ? 'Creating project...' : 'Approve & Create Project'}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* INFRASTRUCTURE PRE-SANCTION TABLE */
          infraProposals.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">No infrastructure pre-sanction schemes initialized yet.</p>
              <Link
                href="/dashboard/proposals/new"
                className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
              >
                Initialize first scheme →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Tracking Code</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Project Corridor</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Agency / Ministry</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">CapEx Budget</th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase tracking-wider">Vetting Portal</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {infraProposals.map((proposal) => {
                    const isSanctioned = proposal.status === 'AA_FS_SANCTIONED'
                    return (
                      <tr key={proposal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-gray-900">{proposal.proposalCode}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{proposal.title}</div>
                          <div className="text-xs text-gray-500">Category: {proposal.category}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{proposal.sponsoringMinistry}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-semibold text-blue-600">₹{proposal.estimatedBudgetCr} Cr</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 text-xs font-extrabold rounded-full border ${
                              isSanctioned
                                ? 'bg-green-50 text-green-700 border-green-200'
                                : proposal.status === 'PROPOSAL_DRAFT'
                                ? 'bg-gray-50 text-gray-600 border-gray-200'
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}
                          >
                            {proposal.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/dashboard/proposals/${proposal.id}`}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-semibold shadow-sm transition"
                          >
                            Open Sanction Hub →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
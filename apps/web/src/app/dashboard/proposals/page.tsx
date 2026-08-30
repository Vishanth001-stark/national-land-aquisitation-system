'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function ProposalsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; projectId?: string } | null>(null)

  const isCentralOrAdmin =
    session?.user?.role === ROLES.CENTRAL_MINISTRY ||
    session?.user?.role === ROLES.SYSTEM_ADMIN

  const fetchProposals = async () => {
    try {
      const res = await fetch('/api/proposals')
      if (res.ok) {
        const data = await res.json()
        setProposals(data)
      }
    } catch (err) {
      console.error('Error fetching proposals:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProposals()
  }, [])

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
        await fetchProposals()
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isCentralOrAdmin ? 'Land Acquisition Proposals' : 'My Proposals'}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Review submissions and convert approved proposals into official acquisition projects.
            </p>
          </div>
          <Link
            href="/dashboard/proposals/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + New Proposal
          </Link>
        </div>

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

        {proposals.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No proposals yet.</p>
            <Link
              href="/dashboard/proposals/new"
              className="text-blue-600 hover:text-blue-700"
            >
              Create your first proposal →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Land Area
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {isCentralOrAdmin && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
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
                        <div className="text-sm font-medium text-gray-900">{proposal.title}</div>
                        <div className="text-xs text-gray-500 capitalize">{proposal.purpose}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {proposal.location}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {proposal.landArea} acres
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ₹{(proposal.estimatedCost / 10000000).toFixed(2)} Cr
                      </td>
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {isConverted ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-md border border-green-200 text-xs font-semibold">
                              ✓ Converted to Project
                            </span>
                          ) : (
                            <button
                              id={`approve-btn-${proposal.id}`}
                              onClick={() => handleApprove(proposal.id)}
                              disabled={isApproving}
                              className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-xs font-semibold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
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
        )}
      </div>
    </div>
  )
}
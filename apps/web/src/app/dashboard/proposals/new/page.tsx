'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewProposalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Infra Proposal State
  const [infraForm, setInfraForm] = useState({
    proposalCode: '',
    title: '',
    sponsoringMinistry: 'NHAI',
    category: 'GREENFIELD',
    estimatedBudgetCr: '',
  })

  // Auto-generate proposal code helper
  const handleGenerateCode = (agency: string) => {
    const randomNum = Math.floor(100 + Math.random() * 900)
    const year = new Date().getFullYear()
    setInfraForm((prev) => ({
      ...prev,
      proposalCode: `PROP-${agency.toUpperCase()}-${year}-${randomNum}`,
    }))
  }

  // Initial code generation
  useEffect(() => {
    handleGenerateCode('NHAI')
  }, [])

  const handleInfraSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalCode: infraForm.proposalCode,
          title: infraForm.title,
          sponsoringMinistry: infraForm.sponsoringMinistry,
          category: infraForm.category,
          estimatedBudgetCr: parseFloat(infraForm.estimatedBudgetCr),
        }),
      })

      if (response.ok) {
        router.push('/dashboard/proposals')
      } else {
        const data = await response.json()
        setError(data?.error ?? 'Failed to create pre-sanction proposal. Please check for unique code.')
      }
    } catch (err) {
      console.error('Error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Initialize Infrastructure Project</h1>
            <p className="text-sm text-gray-500 mt-1">Submit new corridor schemes for feasibility checks and statutory clearance dockets.</p>
          </div>

          {/* Form container */}
          <div className="bg-white rounded-lg shadow p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6 animate-pulse">
                {error}
              </div>
            )}

            <form onSubmit={handleInfraSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sponsoring Ministry / Agency *
                  </label>
                  <select
                    value={infraForm.sponsoringMinistry}
                    onChange={(e) => {
                      setInfraForm({ ...infraForm, sponsoringMinistry: e.target.value })
                      handleGenerateCode(e.target.value)
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900"
                  >
                    <option value="NHAI">National Highways Authority of India (NHAI)</option>
                    <option value="MoR">Ministry of Railways (MoR)</option>
                    <option value="PWD">State Public Works Department (PWD)</option>
                    <option value="DFCCIL">Dedicated Freight Corridor (DFCCIL)</option>
                  </select>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleGenerateCode(infraForm.sponsoringMinistry)}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-bold rounded-lg text-xs transition"
                  >
                    🔄 Regenerate Code
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proposal Tracking Code (Unique) *
                </label>
                <input
                  type="text"
                  required
                  value={infraForm.proposalCode}
                  onChange={(e) => setInfraForm({ ...infraForm, proposalCode: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-mono font-bold text-sm text-gray-900"
                  placeholder="e.g. PROP-NHAI-2026-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Corridor Title *
                </label>
                <input
                  type="text"
                  required
                  value={infraForm.title}
                  onChange={(e) => setInfraForm({ ...infraForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900"
                  placeholder="e.g., Bengaluru-Mysuru Greenfield Expressway Alignment"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Corridor Category *
                  </label>
                  <select
                    value={infraForm.category}
                    onChange={(e) => setInfraForm({ ...infraForm, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900"
                  >
                    <option value="GREENFIELD">GREENFIELD (New alignment corridor)</option>
                    <option value="BROWNFIELD">BROWNFIELD (Expansion / Doubling)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated CapEx Budget (₹ Crores) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={infraForm.estimatedBudgetCr}
                    onChange={(e) => setInfraForm({ ...infraForm, estimatedBudgetCr: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900"
                    placeholder="e.g., 1450"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Initializing...' : 'Initialize Pre-Sanction Project'}
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
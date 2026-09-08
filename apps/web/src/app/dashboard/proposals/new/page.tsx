'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface DistrictItem {
  id: string
  name: string
  stateId: string
}

interface StateItem {
  id: string
  name: string
  code: string
  districts: DistrictItem[]
}

export default function NewProposalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Locations state
  const [states, setStates] = useState<StateItem[]>([])
  const [loadingLocations, setLoadingLocations] = useState(true)

  // Infra Proposal Form State
  const [infraForm, setInfraForm] = useState({
    proposalCode: '',
    title: '',
    sponsoringMinistry: 'NHAI',
    category: 'GREENFIELD',
    estimatedBudgetCr: '',
    stateId: '',
    districtId: '',
  })

  // Fetch States & Districts from /api/locations
  useEffect(() => {
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data: StateItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setStates(data)

          // Default to first state (or Karnataka / Rajasthan)
          const defaultState = data.find((s) => s.code === 'KA') || data[0]
          const defaultDistrict = defaultState.districts[0]

          setInfraForm((prev) => ({
            ...prev,
            stateId: defaultState.id,
            districtId: defaultDistrict ? defaultDistrict.id : '',
            title: defaultDistrict ? `${defaultDistrict.name} Greenfield Expressway Corridor` : prev.title,
          }))
        }
      })
      .catch((err) => {
        console.error('Error fetching locations:', err)
      })
      .finally(() => {
        setLoadingLocations(false)
      })
  }, [])

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

  // Currently selected state object
  const currentState = states.find((s) => s.id === infraForm.stateId)
  const availableDistricts = currentState?.districts || []

  // When state changes, update district to first available district of that state
  const handleStateChange = (stateId: string) => {
    const stateObj = states.find((s) => s.id === stateId)
    const firstDist = stateObj?.districts[0]
    setInfraForm((prev) => ({
      ...prev,
      stateId,
      districtId: firstDist ? firstDist.id : '',
      title: firstDist ? `${firstDist.name} Greenfield Expressway Corridor` : prev.title,
    }))
  }

  const handleDistrictChange = (districtId: string) => {
    const distObj = availableDistricts.find((d) => d.id === districtId)
    setInfraForm((prev) => ({
      ...prev,
      districtId,
      title: distObj ? `${distObj.name} Greenfield Expressway Corridor` : prev.title,
    }))
  }

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
          stateId: infraForm.stateId || null,
          districtId: infraForm.districtId || null,
        }),
      })

      if (response.ok) {
        const created = await response.json()
        router.push(`/dashboard/proposals/${created.id}`)
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
    <div className="max-w-3xl mx-auto py-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Initialize Infrastructure Project</h1>
        <p className="text-sm text-gray-500 mt-1">
          Specify location, sponsoring agency, and CapEx budget for PM GatiShakti pre-construction feasibility.
        </p>
      </div>

      {/* Form container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6 flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleInfraSubmit} className="space-y-6">
          {/* Sponsoring Agency & Code Generator */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                Sponsoring Ministry / Agency *
              </label>
              <select
                value={infraForm.sponsoringMinistry}
                onChange={(e) => {
                  setInfraForm({ ...infraForm, sponsoringMinistry: e.target.value })
                  handleGenerateCode(e.target.value)
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900 font-medium"
              >
                <option value="NHAI">National Highways Authority of India (NHAI)</option>
                <option value="MoR">Ministry of Railways (MoR)</option>
                <option value="PWD">State Public Works Department (PWD)</option>
                <option value="DFCCIL">Dedicated Freight Corridor Corporation (DFCCIL)</option>
                <option value="MoPNG">Ministry of Petroleum & Natural Gas (MoPNG)</option>
              </select>
            </div>
            <div>
              <button
                type="button"
                onClick={() => handleGenerateCode(infraForm.sponsoringMinistry)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 font-bold rounded-lg text-xs transition"
              >
                🔄 Regenerate Code
              </button>
            </div>
          </div>

          {/* Proposal Tracking Code */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Proposal Tracking Code (Unique) *
            </label>
            <input
              type="text"
              required
              value={infraForm.proposalCode}
              onChange={(e) => setInfraForm({ ...infraForm, proposalCode: e.target.value.toUpperCase() })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-mono font-bold text-sm text-gray-900"
              placeholder="e.g. PROP-NHAI-2026-001"
            />
          </div>

          {/* LOCATION SELECTION: STATE & CITY / DISTRICT */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-base">📍</span>
              <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider">
                Jurisdictional Location (State & City / District)
              </h3>
            </div>
            <p className="text-xs text-gray-600">
              Select the administrative State and District/City where this project corridor will be vetted and notified.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Target State *
                </label>
                <select
                  required
                  value={infraForm.stateId}
                  onChange={(e) => handleStateChange(e.target.value)}
                  disabled={loadingLocations}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900 font-semibold"
                >
                  {states.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Target City / District *
                </label>
                <select
                  required
                  value={infraForm.districtId}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={loadingLocations || availableDistricts.length === 0}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900 font-semibold"
                >
                  {availableDistricts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Project Corridor Title */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              Project Corridor Title *
            </label>
            <input
              type="text"
              required
              value={infraForm.title}
              onChange={(e) => setInfraForm({ ...infraForm, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900 font-medium"
              placeholder="e.g., Bengaluru-Mysuru Greenfield Expressway Alignment"
            />
          </div>

          {/* Category & Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                Corridor Category *
              </label>
              <select
                value={infraForm.category}
                onChange={(e) => setInfraForm({ ...infraForm, category: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900 font-medium"
              >
                <option value="GREENFIELD">GREENFIELD (New alignment corridor)</option>
                <option value="BROWNFIELD">BROWNFIELD (Expansion / Doubling)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                Estimated CapEx Budget (₹ Crores) *
              </label>
              <input
                type="number"
                required
                min="1"
                value={infraForm.estimatedBudgetCr}
                onChange={(e) => setInfraForm({ ...infraForm, estimatedBudgetCr: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm text-gray-900 font-bold text-blue-700"
                placeholder="e.g., 1450"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Initializing Pre-Sanction Scheme...' : 'Initialize Scheme & Open Sanction Hub →'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-sm transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
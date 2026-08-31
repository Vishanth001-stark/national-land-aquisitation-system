'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import Navbar from '@/components/Navbar'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface Alignment {
  id: string
  alignmentName: string
  isPreferred: boolean
  bufferWidthMeters: number
  totalLengthKm: number
  forestOverlapHa: number
  waterbodyOverlapHa: number
  clearanceRiskScore: string
  centerlineGeojson?: any
  corridorGeojson?: any
  utilityIntersectsCount?: number
}

interface Clearance {
  id: string
  clearanceType: string
  status: 'NOT_APPLIED' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'
  referenceNo?: string
  submittedDate?: string
  approvalDate?: string
  remarks?: string
}

interface Proposal {
  id: string
  proposalCode: string
  title: string
  sponsoringMinistry: string
  category: string
  estimatedBudgetCr: number
  status: string
  alignments?: Alignment[]
  clearances?: Clearance[]
}

const MOCK_ALIGNMENT_A = {
  name: 'Option A - Greenfield Bypass (Low Impact)',
  geojson: {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [77.5946, 12.9716], // Bangalore
        [77.3500, 12.7500], // Bypassing Bannerghatta (which is 77.50-77.70, 12.70-12.90)
        [77.0000, 12.5000],
        [76.6394, 12.2958], // Mysore
      ],
    },
  },
}

const MOCK_ALIGNMENT_B = {
  name: 'Option B - Forest Transit (High Impact)',
  geojson: {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [77.5946, 12.9716], // Bangalore
        [77.6000, 12.8000], // Cuts directly through Bannerghatta forest!
        [76.6394, 12.2958], // Mysore
      ],
    },
  },
}

export default function ProposalSanctionHub({ params }: { params: any }) {
  const resolvedParams = React.use<any>(params)
  const proposalId = resolvedParams?.id

  const router = useRouter()
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [alignments, setAlignments] = useState<Alignment[]>([])
  const [clearances, setClearances] = useState<Clearance[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Form states
  const [customAlignmentName, setCustomAlignmentName] = useState('')
  const [bufferWidth, setBufferWidth] = useState(60)
  const [customGeojsonText, setCustomGeojsonText] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Clearance Update states
  const [editingClearance, setEditingClearance] = useState<Clearance | null>(null)
  const [clearanceStatus, setClearanceStatus] = useState<any>('SUBMITTED')
  const [clearanceRefNo, setClearanceRefNo] = useState('')
  const [clearanceRemarks, setClearanceRemarks] = useState('')

  // Sanction Modal states
  const [showSanctionModal, setShowSanctionModal] = useState(false)
  const [sanctionForm, setSanctionForm] = useState({
    sanctionOrderNo: '',
    sanctionedAmountCr: 0,
    landAcquisitionBudgetCr: 0,
    civilWorksBudgetCr: 0,
    sanctioningAuthority: 'CCEA',
    sanctionDate: new Date().toISOString().split('T')[0],
  })

  const loadData = async () => {
    try {
      // Fetch proposal details via main route
      const res = await fetch(`/api/proposals?type=infra`)
      if (res.ok) {
        const json = await res.json()
        const found = json.data?.find((p: any) => p.id === proposalId)
        if (found) {
          setProposal(found)
        }
      }

      // Fetch alignments
      const resAlign = await fetch(`/api/proposals/${proposalId}/alignments`)
      if (resAlign.ok) {
        const jsonAlign = await resAlign.json()
        setAlignments(jsonAlign)
      }

      // Fetch clearances
      const resClear = await fetch(`/api/proposals/${proposalId}/clearances`)
      if (resClear.ok) {
        const jsonClear = await resClear.json()
        setClearances(jsonClear)
      }
    } catch (err) {
      console.error('Error loading sanction hub data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (proposalId) {
      loadData()
    }
  }, [proposalId])

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [77.0000, 12.6000], // Centered between Bangalore & Mysore
      zoom: 8.5,
    })

    map.current.on('load', () => {
      setMapLoaded(true)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Draw Alignments on Map
  useEffect(() => {
    if (!map.current || !mapLoaded || alignments.length === 0) return

    const m = map.current

    // Cleanup previous alignment layers/sources
    alignments.forEach((align) => {
      const lineLayer = `line-${align.id}`
      const fillLayer = `fill-${align.id}`

      if (m.getLayer(lineLayer)) m.removeLayer(lineLayer)
      if (m.getLayer(fillLayer)) m.removeLayer(fillLayer)
      if (m.getSource(align.id)) m.removeSource(align.id)
    })

    // Draw current alignments
    alignments.forEach((align) => {
      if (!align.centerlineGeojson || !align.corridorGeojson) return

      const color = align.isPreferred ? '#eab308' : '#06b6d4' // Yellow for locked/preferred, Cyan for alternative

      m.addSource(align.id, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: align.corridorGeojson,
              properties: { type: 'corridor' },
            },
            {
              type: 'Feature',
              geometry: align.centerlineGeojson,
              properties: { type: 'centerline' },
            },
          ],
        },
      })

      // Add Corridor (polygon fill) layer
      m.addLayer({
        id: `fill-${align.id}`,
        type: 'fill',
        source: align.id,
        filter: ['==', ['get', 'type'], 'corridor'],
        paint: {
          'fill-color': color,
          'fill-opacity': 0.15,
          'fill-outline-color': color,
        },
      })

      // Add Centerline (linestring) layer
      m.addLayer({
        id: `line-${align.id}`,
        type: 'line',
        source: align.id,
        filter: ['==', ['get', 'type'], 'centerline'],
        paint: {
          'line-color': color,
          'line-width': 4,
          'line-dasharray': align.isPreferred ? [] : [2, 2],
        },
      })
    })
  }, [alignments, mapLoaded])

  // Upload/Evaluate alignment
  const handleUploadAlignment = async (name: string, buffer: number, geojsonObj: any) => {
    setActionLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/alignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alignmentName: name,
          bufferWidthMeters: buffer,
          centerlineGeojson: geojsonObj,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to upload alignment')
      } else {
        await loadData()
        setCustomAlignmentName('')
        setCustomGeojsonText('')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Error connecting to spatial API')
    } finally {
      setActionLoading(false)
    }
  }

  // Lock Preferred alignment
  const handleLockAlignment = async (alignmentId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/proposals/${proposalId}/select-alignment/${alignmentId}`, {
        method: 'PUT',
      })
      if (res.ok) {
        await loadData()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Update statutory clearance
  const handleUpdateClearance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingClearance) return
    setActionLoading(true)

    try {
      const res = await fetch(`/api/proposals/${proposalId}/clearances/${editingClearance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: clearanceStatus,
          referenceNo: clearanceRefNo || null,
          submittedDate: new Date().toISOString(),
          approvalDate: clearanceStatus === 'APPROVED' ? new Date().toISOString() : null,
          remarks: clearanceRemarks || null,
        }),
      })

      if (res.ok) {
        await loadData()
        setEditingClearance(null)
        setClearanceRefNo('')
        setClearanceRemarks('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  // Record Financial Sanction AA&FS
  const handleConfirmSanction = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch(`/api/proposals/${proposalId}/sanction-aafs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sanctionForm,
          sanctionedAmountCr: Number(sanctionForm.sanctionedAmountCr),
          landAcquisitionBudgetCr: Number(sanctionForm.landAcquisitionBudgetCr),
          civilWorksBudgetCr: Number(sanctionForm.civilWorksBudgetCr),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to submit sanction details')
      } else {
        setShowSanctionModal(false)
        await loadData()
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Error establishing connection to financial sanction engine')
    } finally {
      setActionLoading(false)
    }
  }

  const exportEnvelope = async () => {
    try {
      window.open(`/api/proposals/${proposalId}/export-sanctioned-envelope`, '_blank')
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500 font-medium">Loading Pre-Construction lifecycle data...</div>
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500 font-medium">Infrastructure Proposal not found.</div>
      </div>
    )
  }

  const steps = [
    { label: 'Concept (Draft)', key: 'PROPOSAL_DRAFT' },
    { label: 'Pre-Feasibility', key: 'PRE_FEASIBILITY_APPROVED' },
    { label: 'DPR Preparation', key: 'DPR_UNDER_PREPARATION' },
    { label: 'Clearance Gate', key: 'CLEARANCE_PENDING' },
    { label: 'PIB Review', key: 'PIB_SANCTION_REVIEW' },
    { label: 'Sanctioned (AA&FS)', key: 'AA_FS_SANCTIONED' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === proposal.status)
  const isSanctioned = proposal.status === 'AA_FS_SANCTIONED'
  const preferredAlignment = alignments.find((a) => a.isPreferred)
  const isClearanceApproved = clearances.length > 0 && clearances.every((c) => c.status === 'APPROVED')
  const canUnlockSanction = preferredAlignment && isClearanceApproved && !isSanctioned

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        {/* Proposal Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
                  {proposal.category}
                </span>
                <span className="text-sm text-gray-500 font-mono font-bold">
                  {proposal.proposalCode}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">{proposal.title}</h1>
              <p className="text-sm text-gray-600 mt-0.5">Sponsoring Agency: {proposal.sponsoringMinistry}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 block">ESTIMATED BUDGET</span>
              <span className="text-3xl font-black text-blue-600">₹ {proposal.estimatedBudgetCr} Cr</span>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-8 border-t pt-8">
            <div className="flex items-center justify-between">
              {steps.map((step, idx) => {
                const isPassed = idx <= currentStepIndex
                const isCurrent = idx === currentStepIndex
                return (
                  <div key={step.key} className="flex-1 flex flex-col items-center relative">
                    {/* Connecting line */}
                    {idx < steps.length - 1 && (
                      <div
                        className={`absolute top-4 left-1/2 w-full h-0.5 z-0 ${
                          idx < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                    {/* Step bubble */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm relative z-10 ${
                        isPassed
                          ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                          : 'bg-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-blue-300' : ''}`}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={`text-xs font-semibold mt-2 text-center max-w-[120px] ${
                        isCurrent ? 'text-blue-700 font-bold' : isPassed ? 'text-gray-800' : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Columns - Alignments Analysis & Map */}
          <div className="lg:col-span-2 space-y-8">
            {/* Map */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex justify-between items-center">
                <span>Alignment Corridor Visualization Map</span>
                <span className="text-xs font-normal text-gray-500">
                  Preferred (Yellow) | Alternatives (Cyan)
                </span>
              </h2>
              <div
                ref={mapContainer}
                className="w-full h-[400px] rounded-lg border bg-gray-200 relative overflow-hidden"
              />
            </div>

            {/* Alignment Upload & MCDA Matrix */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Multi-Alignment Decision Matrix</h2>

              {/* Mock Upload Pre-Bakes */}
              <div className="bg-gray-50 border rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-500 font-bold mb-2">SIH DEV TESTBED: EVALUATE MOCK ALIGNMENT SCHEMES</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      handleUploadAlignment(
                        MOCK_ALIGNMENT_A.name,
                        bufferWidth,
                        MOCK_ALIGNMENT_A.geojson
                      )
                    }
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded shadow transition disabled:opacity-50"
                  >
                    Run Option A Evaluation (Bypass)
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() =>
                      handleUploadAlignment(
                        MOCK_ALIGNMENT_B.name,
                        bufferWidth,
                        MOCK_ALIGNMENT_B.geojson
                      )
                    }
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded shadow transition disabled:opacity-50"
                  >
                    Run Option B Evaluation (Forest Cut)
                  </button>
                </div>
              </div>

              {/* Alignment List Matrix Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Alignment Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Length (km)</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Forest (Ha)</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Water (Ha)</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Grid Cross</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Vetting Score</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {alignments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                          No alignment options evaluated yet. Use the testbed above to seed alignments.
                        </td>
                      </tr>
                    ) : (
                      alignments.map((a) => (
                        <tr key={a.id} className={a.isPreferred ? 'bg-amber-50/40' : ''}>
                          <td className="px-4 py-3 font-semibold text-gray-900 flex items-center gap-2">
                            {a.isPreferred && (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse inline-block" />
                            )}
                            {a.alignmentName}
                          </td>
                          <td className="px-4 py-3">{a.totalLengthKm} km</td>
                          <td className="px-4 py-3 text-red-600 font-semibold">{a.forestOverlapHa} Ha</td>
                          <td className="px-4 py-3">{a.waterbodyOverlapHa} Ha</td>
                          <td className="px-4 py-3">{a.utilityIntersectsCount ?? 0}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                a.clearanceRiskScore === 'HIGH'
                                  ? 'bg-red-100 text-red-800'
                                  : a.clearanceRiskScore === 'MEDIUM'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {a.clearanceRiskScore} RISK
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {a.isPreferred ? (
                              <span className="text-xs text-amber-600 font-extrabold uppercase">LOCKED</span>
                            ) : (
                              <button
                                disabled={actionLoading}
                                onClick={() => handleLockAlignment(a.id)}
                                className="px-2 py-1 text-xs text-blue-600 hover:text-white hover:bg-blue-600 rounded border border-blue-600 transition"
                              >
                                Lock Preferred
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column - Clearances Checklist & Sanction Card */}
          <div className="space-y-8">
            {/* Statutory Clearances */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Statutory Clearances Matrix</h2>
              <div className="space-y-4">
                {clearances.map((c) => (
                  <div key={c.id} className="border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-800">{c.clearanceType}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-extrabold uppercase ${
                          c.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'NOT_APPLIED'
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-1">
                      <span>Ref: {c.referenceNo || 'N/A'}</span>
                      <button
                        onClick={() => {
                          setEditingClearance(c)
                          setClearanceStatus(c.status)
                          setClearanceRefNo(c.referenceNo || '')
                        }}
                        className="text-blue-600 hover:underline"
                      >
                        Update milestone
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clearance Update Overlay Modal Panel */}
            {editingClearance && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <h3 className="text-sm font-bold text-blue-800 mb-3">
                  Update Clearance: {editingClearance.clearanceType}
                </h3>
                <form onSubmit={handleUpdateClearance} className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">Status</label>
                    <select
                      value={clearanceStatus}
                      onChange={(e) => setClearanceStatus(e.target.value)}
                      className="w-full text-sm border rounded p-1.5 bg-white"
                    >
                      <option value="SUBMITTED">SUBMITTED</option>
                      <option value="IN_REVIEW">IN_REVIEW</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">Reference No</label>
                    <input
                      type="text"
                      value={clearanceRefNo}
                      onChange={(e) => setClearanceRefNo(e.target.value)}
                      className="w-full text-sm border rounded p-1.5 bg-white"
                      placeholder="e.g. NOC-120839"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 font-semibold mb-1">Remarks</label>
                    <textarea
                      value={clearanceRemarks}
                      onChange={(e) => setClearanceRemarks(e.target.value)}
                      className="w-full text-xs border rounded p-1.5 bg-white"
                      placeholder="Remarks/notes"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow"
                    >
                      Save Vetting Status
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingClearance(null)}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Financial Sanction & AA&FS Gatekeeper Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Financial Sanction Gatekeeper</h2>

              {isSanctioned ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg text-sm font-semibold">
                    ✅ Proposal Sanctioned (AA&FS Approved)
                  </div>
                  <button
                    onClick={exportEnvelope}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded shadow transition flex items-center justify-center gap-2"
                  >
                    📂 Export Sanctioned Envelope GeoJSON
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Gatekeeper Checklists */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={preferredAlignment ? 'text-green-600' : 'text-gray-400'}>
                        {preferredAlignment ? '✅' : '❌'}
                      </span>
                      <span className={preferredAlignment ? 'text-gray-800' : 'text-gray-400'}>
                        Preferred corridor alignment locked
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={isClearanceApproved ? 'text-green-600' : 'text-gray-400'}>
                        {isClearanceApproved ? '✅' : '❌'}
                      </span>
                      <span className={isClearanceApproved ? 'text-gray-800' : 'text-gray-400'}>
                        All statutory clearances APPROVED
                      </span>
                    </div>
                  </div>

                  {canUnlockSanction ? (
                    <button
                      onClick={() => {
                        setShowSanctionModal(true)
                        setSanctionForm((prev) => ({
                          ...prev,
                          sanctionedAmountCr: proposal.estimatedBudgetCr,
                          landAcquisitionBudgetCr: Math.round(proposal.estimatedBudgetCr * 0.3), // default estimate 30% LA
                          civilWorksBudgetCr: Math.round(proposal.estimatedBudgetCr * 0.7),
                        }))
                      }}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded shadow-lg transition"
                    >
                      🔓 Approve AA&FS Financial Sanction
                    </button>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-4 rounded-lg text-xs leading-relaxed">
                      ⚠️ **Gatekeeper Blocked**: To unlock Financial Sanction, you must select a preferred corridor and approve all 7 statutory clearances.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sanction Modal Overlay */}
      {showSanctionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">
              Issue AA&FS Sanction Order
            </h3>
            <form onSubmit={handleConfirmSanction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Sanction Order Number *</label>
                <input
                  required
                  type="text"
                  value={sanctionForm.sanctionOrderNo}
                  onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionOrderNo: e.target.value })}
                  className="w-full text-sm border rounded p-2 bg-white"
                  placeholder="e.g. CCEA-FS-2026/NH-108"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Total CapEx (Cr) *</label>
                  <input
                    required
                    type="number"
                    value={sanctionForm.sanctionedAmountCr}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionedAmountCr: Number(e.target.value) })}
                    className="w-full text-sm border rounded p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Land Acq Budget (Cr) *</label>
                  <input
                    required
                    type="number"
                    value={sanctionForm.landAcquisitionBudgetCr}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, landAcquisitionBudgetCr: Number(e.target.value) })}
                    className="w-full text-sm border rounded p-2 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Civil Works Budget (Cr) *</label>
                  <input
                    required
                    type="number"
                    value={sanctionForm.civilWorksBudgetCr}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, civilWorksBudgetCr: Number(e.target.value) })}
                    className="w-full text-sm border rounded p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Competent Authority *</label>
                  <select
                    value={sanctionForm.sanctioningAuthority}
                    onChange={(e) => setSanctionForm({ ...sanctionForm, sanctioningAuthority: e.target.value })}
                    className="w-full text-sm border rounded p-2 bg-white"
                  >
                    <option value="CCEA">Cabinet Committee on Economic Affairs (CCEA)</option>
                    <option value="PIB">Public Investment Board (PIB)</option>
                    <option value="MINISTRY_SFC">Ministry Standing Finance Committee (SFC)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Sanction Date *</label>
                <input
                  required
                  type="date"
                  value={sanctionForm.sanctionDate}
                  onChange={(e) => setSanctionForm({ ...sanctionForm, sanctionDate: e.target.value })}
                  className="w-full text-sm border rounded p-2 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded shadow transition disabled:opacity-50"
                >
                  Confirm Financial Sanction
                </button>
                <button
                  type="button"
                  onClick={() => setShowSanctionModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

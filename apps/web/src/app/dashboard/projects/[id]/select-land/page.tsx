'use client'

import { useEffect, useState, useRef, use } from 'react'
import RoleGuard from '@/components/RoleGuard'
import { ROLES } from '@/lib/roles'
import Link from 'next/link'
import { doPolygonsIntersect, parseGeoJSONRing, Polygon, Point } from '@/lib/spatial'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface CadastralParcel {
  id: string
  ulpin?: string | null
  surveyNumber?: string | null
  areaHectares?: number | null
  landType?: string | null
  ownerName?: string | null
  compensationAmount?: number | null
  latitude?: number | null
  longitude?: number | null
  geometryJson?: any
  projectId?: string | null
}

interface Project {
  id: string
  name: string
  projectType: string
  status: string
  totalAreaHectares?: number | null
  estimatedCost?: number | null
  state?: { name: string; code: string } | null
  district?: { name: string } | null
}

interface InvitationPreview {
  invitationId: string
  parcelId: string
  surveyNumber: string
  ownerName: string
  areaHectares?: number | null
  compensationAmount?: number | null
  invitationCode: string
  status: string
  expiresAt: string
  deliveryStatus: string
  honestyNotice: string
}

const CITY_COORDS: Record<string, [number, number]> = {
  'Delhi': [28.6139, 77.2090],
  'Mumbai': [19.0760, 72.8777],
  'Bangalore': [12.9716, 77.5946],
  'Bengaluru': [12.9716, 77.5946],
  'Chennai': [13.0827, 80.2707],
  'Kolkata': [22.5726, 88.3639],
  'Hyderabad': [17.3850, 78.4867],
  'Pune': [18.5204, 73.8567],
  'Ahmedabad': [23.0225, 72.5714],
  'Jaipur': [26.9124, 75.7873],
  'Lucknow': [26.8467, 80.9462],
  'Mysore': [12.2958, 76.6394],
  'Mangalore': [12.9141, 74.8560],
  'Hubli': [15.3647, 75.1240],
  'Belgaum': [15.8497, 74.4977],
}

export default function SelectLandPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const projectId = resolvedParams.id

  const [project, setProject] = useState<Project | null>(null)
  const [candidateParcels, setCandidateParcels] = useState<CadastralParcel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Map selection state
  const [drawMode, setDrawMode] = useState<'rectangle' | 'polygon' | null>(null)
  const [drawnPoints, setDrawnPoints] = useState<Point[]>([])
  const [intersectedParcels, setIntersectedParcels] = useState<CadastralParcel[]>([])
  const [isConfirming, setIsConfirming] = useState(false)
  const [isGeneratingInvs, setIsGeneratingInvs] = useState(false)
  const [invitations, setInvitations] = useState<InvitationPreview[] | null>(null)
  const [confirmedSuccess, setConfirmedSuccess] = useState<string | null>(null)
  const [showNotificationModal, setShowNotificationModal] = useState(false)
  const [showSatellite, setShowSatellite] = useState(false)

  // Leaflet map container & instance refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  // Resolve dynamic map center based on project location
  const resolveMapCenter = (): [number, number] => {
    if (project?.district?.name && CITY_COORDS[project.district.name]) {
      return CITY_COORDS[project.district.name]
    }
    if (project?.name) {
      const matchedCity = Object.keys(CITY_COORDS).find((city) =>
        project.name.toLowerCase().includes(city.toLowerCase())
      )
      if (matchedCity) return CITY_COORDS[matchedCity]
    }
    return [26.9124, 75.7873] // Jaipur default
  }

  // Fetch project details and candidate parcels
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projRes, parcelsRes] = await Promise.all([
          fetch('/api/projects'),
          fetch('/api/cadastral-parcels'),
        ])

        if (projRes.ok) {
          const projects = await projRes.json()
          const matched = projects.find((p: any) => p.id === projectId)
          if (matched) {
            setProject(matched)
          } else {
            setError('Project not found')
          }
        }

        if (parcelsRes.ok) {
          const parcelsData = await parcelsRes.json()
          setCandidateParcels(parcelsData.parcels || [])
        } else if (parcelsRes.status === 403) {
          setError('Forbidden: Only Central Ministry or System Admin officers may access land selection.')
        }
      } catch (err) {
        console.error('Error loading land selection data:', err)
        setError('Network error loading project details')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId])

  // Spatial Intersection calculation when drawnPoints change
  useEffect(() => {
    if (drawnPoints.length < 3) {
      setIntersectedParcels([])
      return
    }

    const userPoly = drawnPoints

    const matches = candidateParcels.filter((parcel) => {
      if (!parcel.geometryJson) return false
      const ring = parseGeoJSONRing(parcel.geometryJson)
      if (!ring) return false
      return doPolygonsIntersect(userPoly, ring)
    })

    setIntersectedParcels(matches)
  }, [drawnPoints, candidateParcels])

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || loading) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const [centerLat, centerLng] = resolveMapCenter()

    const map = L.map(mapContainerRef.current).setView([centerLat, centerLng], 14)

    const tileUrl = showSatellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

    const attribution = showSatellite
      ? '&copy; Esri &mdash; World Imagery'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

    L.tileLayer(tileUrl, { maxZoom: 19, attribution }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)
    layerGroupRef.current = layerGroup

    mapInstanceRef.current = map

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [loading, project, showSatellite])

  // Render parcel polygons & drawn boundary on Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current
    const layerGroup = layerGroupRef.current
    if (!map || !layerGroup) return

    layerGroup.clearLayers()

    // 1. Draw candidate cadastral parcels
    candidateParcels.forEach((parcel) => {
      const ring = parseGeoJSONRing(parcel.geometryJson)
      if (!ring || ring.length < 3) return

      // Convert [lng, lat] -> [lat, lng] for Leaflet
      const leafletCoords: L.LatLngExpression[] = ring.map(([lng, lat]) => [lat, lng])

      const isSelected = intersectedParcels.some((p) => p.id === parcel.id)
      const isConfirmed = parcel.projectId === projectId

      const color = isSelected ? '#eab308' : isConfirmed ? '#22c55e' : '#3b82f6'
      const fillColor = isSelected ? '#fef08a' : isConfirmed ? '#86efac' : '#93c5fd'
      const fillOpacity = isSelected ? 0.6 : isConfirmed ? 0.4 : 0.25

      const polyLayer = L.polygon(leafletCoords, {
        color,
        fillColor,
        fillOpacity,
        weight: isSelected ? 3 : 2,
      })

      const popupContent = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 180px;">
          <h4 style="margin: 0 0 4px 0; font-weight: bold; color: #0f172a; font-size: 13px;">Survey: ${parcel.surveyNumber}</h4>
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b;">ULPIN: ${parcel.ulpin}</p>
          <div style="font-size: 11px; margin-bottom: 2px;">Owner: <b>${parcel.ownerName || 'Unspecified'}</b></div>
          <div style="font-size: 11px; margin-bottom: 2px;">Type: <span style="text-transform: capitalize;">${parcel.landType}</span></div>
          <div style="font-size: 11px; margin-bottom: 4px;">Area: <b>${parcel.areaHectares} Ha</b></div>
          <div style="font-size: 11px; color: #047857; font-weight: bold;">Comp: ₹${((Number(parcel.compensationAmount) || 0) / 100000).toFixed(2)} Lakhs</div>
        </div>
      `
      polyLayer.bindPopup(popupContent)
      layerGroup.addLayer(polyLayer)
    })

    // 2. Draw active user drawn boundary
    if (drawnPoints.length > 0) {
      const drawnLeafletCoords: [number, number][] = drawnPoints.map(([lng, lat]) => [lat, lng])

      if (drawnPoints.length >= 3) {
        const drawnPoly = L.polygon(drawnLeafletCoords, {
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.2,
          dashArray: '6, 6',
          weight: 2.5,
        })
        layerGroup.addLayer(drawnPoly)
      } else {
        const polyline = L.polyline(drawnLeafletCoords, {
          color: '#ef4444',
          weight: 2,
          dashArray: '4, 4',
        })
        layerGroup.addLayer(polyline)
      }

      // Draw point markers
      drawnLeafletCoords.forEach(([lat, lng]) => {
        const circleMarker = L.circleMarker([lat, lng], {
          radius: 5,
          color: '#ffffff',
          fillColor: '#ef4444',
          fillOpacity: 1,
          weight: 2,
        })
        layerGroup.addLayer(circleMarker)
      })
    }
  }, [candidateParcels, intersectedParcels, drawnPoints, projectId])

  // Attach Map Click Handler for Interactive Drawing
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (!drawMode) return

      const lng = e.latlng.lng
      const lat = e.latlng.lat

      if (drawMode === 'rectangle') {
        if (drawnPoints.length === 0) {
          setDrawnPoints([[lng, lat]])
        } else {
          const p1 = drawnPoints[0]
          const p2: Point = [lng, lat]
          const minX = Math.min(p1[0], p2[0])
          const maxX = Math.max(p1[0], p2[0])
          const minY = Math.min(p1[1], p2[1])
          const maxY = Math.max(p1[1], p2[1])

          const rectPoly: Polygon = [
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY],
          ]
          setDrawnPoints(rectPoly)
          setDrawMode(null)
        }
      } else if (drawMode === 'polygon') {
        const newPoints = [...drawnPoints, [lng, lat] as Point]
        if (newPoints.length >= 3) {
          const closed = [...newPoints, newPoints[0]]
          setDrawnPoints(closed)
        } else {
          setDrawnPoints(newPoints)
        }
      }
    }

    map.on('click', handleMapClick)

    return () => {
      map.off('click', handleMapClick)
    }
  }, [drawMode, drawnPoints])

  // Demo preset boundary trigger
  const handleSelectPresetBoundary = () => {
    const [centerLat, centerLng] = resolveMapCenter()
    const sampleBoundary: Polygon = [
      [centerLng - 0.015, centerLat - 0.010],
      [centerLng + 0.015, centerLat - 0.010],
      [centerLng + 0.015, centerLat + 0.010],
      [centerLng - 0.015, centerLat + 0.010],
      [centerLng - 0.015, centerLat - 0.010],
    ]
    setDrawnPoints(sampleBoundary)
  }

  const handleClearSelection = () => {
    setDrawnPoints([])
    setIntersectedParcels([])
    setConfirmedSuccess(null)
    setInvitations(null)
  }

  // Confirm selected parcels for project
  const handleConfirmParcels = async () => {
    if (intersectedParcels.length === 0) return
    setIsConfirming(true)
    setError(null)
    setConfirmedSuccess(null)

    try {
      const parcelIds = intersectedParcels.map((p) => p.id)
      const res = await fetch(`/api/projects/${projectId}/confirm-parcels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelIds }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to confirm parcel selection')
      } else {
        setConfirmedSuccess(data.message)
        const updatedRes = await fetch('/api/cadastral-parcels')
        if (updatedRes.ok) {
          const updatedData = await updatedRes.json()
          setCandidateParcels(updatedData.parcels || [])
        }
      }
    } catch (err) {
      console.error('Error confirming parcels:', err)
      setError('Network error while confirming parcel selection')
    } finally {
      setIsConfirming(false)
    }
  }

  // Generate Citizen Portal Activation Invitations
  const handleGenerateInvitations = async () => {
    setIsGeneratingInvs(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/generate-invitations`, {
        method: 'POST',
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to generate invitations')
      } else {
        setInvitations(data.invitationPreviews || [])
        setShowNotificationModal(true)
      }
    } catch (err) {
      console.error('Error generating invitations:', err)
      setError('Network error generating citizen portal invitations')
    } finally {
      setIsGeneratingInvs(false)
    }
  }

  const totalSelectedAreaHa = intersectedParcels.reduce((sum, p) => sum + (p.areaHectares ? Number(p.areaHectares) : 0), 0)
  const totalSelectedComp = intersectedParcels.reduce((sum, p) => sum + (p.compensationAmount ? Number(p.compensationAmount) : 0), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600 font-medium">Loading interactive map selection engine...</div>
      </div>
    )
  }

  return (
    <RoleGuard allowedRoles={[ROLES.CENTRAL_MINISTRY, ROLES.SYSTEM_ADMIN]}>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard/central" className="hover:text-gray-900">
            National Dashboard
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Map Land Selection</span>
        </div>

        {/* Honesty Badge Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-xl shadow-lg border border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Demo Parcel Data • Representative Cadastral Map
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                Project Land Selection — {project?.name || 'Land Acquisition Project'}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-3xl">
                Draw acquisition boundaries over representative land-record cadastral polygons to compute intersecting parcels, review landowners, confirm selection, and issue citizen portal activation invitations.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Location</span>
              <span className="text-sm font-semibold text-slate-200">
                {project?.district?.name || 'Jaipur'}, {project?.state?.name || 'Rajasthan'}
              </span>
            </div>
          </div>
        </div>

        {/* Status/Error Messages */}
        {error && (
          <div className="p-4 bg-red-50 text-red-800 border border-red-200 rounded-lg text-sm font-medium flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs underline text-red-600">Dismiss</button>
          </div>
        )}

        {confirmedSuccess && (
          <div className="p-4 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-sm font-medium flex justify-between items-center">
            <span>✓ {confirmedSuccess}</span>
            <button onClick={() => setConfirmedSuccess(null)} className="text-xs underline text-emerald-600">Dismiss</button>
          </div>
        )}

        {/* Interactive GIS Leaflet Map & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
              {/* Map Toolbar Controls */}
              <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Drawing Tools:</span>
                  <button
                    onClick={() => {
                      setDrawMode('rectangle')
                      setDrawnPoints([])
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      drawMode === 'rectangle'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    📐 Draw Rectangle Box
                  </button>
                  <button
                    onClick={() => {
                      setDrawMode('polygon')
                      setDrawnPoints([])
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      drawMode === 'polygon'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    ✏️ Draw Polygon Boundary
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSatellite(!showSatellite)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white border border-slate-700 hover:bg-slate-900 transition"
                  >
                    {showSatellite ? '🗺️ Street Map' : '🛰️ Satellite'}
                  </button>
                  <button
                    onClick={handleSelectPresetBoundary}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition"
                  >
                    ✨ Demo Preset Selection
                  </button>
                  {drawnPoints.length > 0 && (
                    <button
                      onClick={handleClearSelection}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 transition"
                    >
                      ✕ Clear Selection
                    </button>
                  )}
                </div>
              </div>

              {/* Leaflet Map Box Container */}
              <div className="relative">
                <div
                  ref={mapContainerRef}
                  className={`w-full h-[500px] z-0 ${drawMode ? 'cursor-crosshair' : 'cursor-default'}`}
                />

                {/* Map Overlay Instructions */}
                <div className="absolute top-4 left-4 bg-slate-900/90 text-white p-3 rounded-lg text-xs backdrop-blur border border-slate-700 max-w-xs space-y-1 z-10">
                  <p className="font-bold text-amber-300">🗺️ Map Legend & Instructions</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-3 h-3 bg-blue-500/40 border border-blue-400 rounded-sm"></span>
                    <span>Representative Candidate Parcels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-amber-500/60 border border-amber-400 rounded-sm"></span>
                    <span>Intersected Selection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-emerald-500/60 border border-emerald-400 rounded-sm"></span>
                    <span>Confirmed Project Land</span>
                  </div>
                  {drawMode && (
                    <p className="text-[11px] text-amber-200 mt-2">
                      Click on map to set {drawMode} boundary points.
                    </p>
                  )}
                </div>
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center">
                Production: Integrate authorized state land-record cadastral GIS feeds (DILRMP/State Land Revenue).
              </div>
            </div>
          </div>

          {/* Side Panel: Affected Land Parcels & Action Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h2 className="text-lg font-bold text-gray-900">
                  Affected Land Parcels
                </h2>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  {intersectedParcels.length} Intersected
                </span>
              </div>

              {intersectedParcels.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">
                  <div className="text-3xl mb-2">🎯</div>
                  <p className="font-semibold text-gray-700">No Parcels Selected Yet</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                    Use the map draw tools or click <strong>&quot;Demo Preset Selection&quot;</strong> to draw an acquisition boundary over representative cadastral parcels.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selection Summary Statistics */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <div>
                      <span className="text-gray-500 block">Total Selected Area</span>
                      <span className="font-bold text-slate-900 text-sm">
                        {totalSelectedAreaHa.toFixed(2)} Ha
                      </span>
                      <span className="text-[10px] text-gray-500 block">
                        ({(totalSelectedAreaHa * 2.47105).toFixed(2)} acres)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Total Compensation</span>
                      <span className="font-bold text-emerald-700 text-sm">
                        ₹{(totalSelectedComp / 100000).toFixed(2)} Lakhs
                      </span>
                    </div>
                  </div>

                  {/* Parcels List */}
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {intersectedParcels.map((parcel) => (
                      <div
                        key={parcel.id}
                        className="p-3 border border-gray-200 rounded-lg bg-gray-50/50 hover:bg-gray-50 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center font-bold text-gray-900">
                          <span>Survey: {parcel.surveyNumber}</span>
                          <span className="text-blue-600 font-mono">{parcel.ulpin}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-gray-600">
                          <div>Landowner: <span className="font-medium text-gray-800">{parcel.ownerName || 'Unspecified'}</span></div>
                          <div>Land Type: <span className="font-medium text-gray-800 capitalize">{parcel.landType}</span></div>
                          <div>Area: <span className="font-medium text-gray-800">{parcel.areaHectares} Ha</span></div>
                          <div>Compensation: <span className="font-bold text-emerald-700">₹{((Number(parcel.compensationAmount) || 0) / 100000).toFixed(2)} L</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Confirm & Generate Buttons */}
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <button
                      onClick={handleConfirmParcels}
                      disabled={isConfirming}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition shadow disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isConfirming ? 'Confirming Parcels...' : '✓ Confirm Selected Parcels for Project'}
                    </button>

                    <button
                      onClick={handleGenerateInvitations}
                      disabled={isGeneratingInvs}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs transition shadow disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isGeneratingInvs ? 'Generating Invitations...' : '✉️ Generate Citizen Portal Activation Invitations'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notification Preview Drawer / Modal */}
        {showNotificationModal && invitations && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-6 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-1 inline-block">
                    Notification Delivery Preview
                  </span>
                  <h3 className="text-xl font-bold">Citizen Portal Activation Invitations</h3>
                </div>
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="text-gray-400 hover:text-white text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {/* Honesty Requirement Alert Box */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                    <span>ℹ️ Honesty Notice & Prototype Status</span>
                  </div>
                  <p className="leading-relaxed">
                    <strong>Notification Prepared for Delivery:</strong> Activation invitation codes have been generated for each verified landowner. In a live production deployment, these invitations are automatically dispatched via state-authorized SMS/Email/WhatsApp notification gateways.
                  </p>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 text-gray-500 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3 text-left">Landowner</th>
                        <th className="px-4 py-3 text-left">Survey No</th>
                        <th className="px-4 py-3 text-left">One-Time Activation Code</th>
                        <th className="px-4 py-3 text-left">Expires</th>
                        <th className="px-4 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 font-medium">
                      {invitations.map((inv) => (
                        <tr key={inv.invitationId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-bold">{inv.ownerName}</td>
                          <td className="px-4 py-3 text-gray-600">{inv.surveyNumber}</td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-mono font-bold rounded border border-indigo-200 text-sm">
                              {inv.invitationCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(inv.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              {inv.deliveryStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  Share invitation code with Citizen for portal activation.
                </span>
                <button
                  onClick={() => setShowNotificationModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition"
                >
                  Close Notification Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  )
}

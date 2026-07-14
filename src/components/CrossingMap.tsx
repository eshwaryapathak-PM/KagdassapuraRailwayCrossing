import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { KAGGADASAPURA } from '../lib/config'
import type { ApproachingTrain, PredictionResult } from '../types'
import { formatTime } from '../lib/prediction'

// Fix leaflet default icon paths broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const makeIcon = (color: string, size = 12) =>
  L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid #0A0F1E;box-shadow:0 0 0 2px ${color}44"></div>`,
    iconAnchor: [size / 2, size / 2],
  })

const crossingIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#F5A623;border:2px solid #0A0F1E;box-shadow:0 0 0 3px #F5A62344"></div>`,
  iconAnchor: [9, 9],
})

const trainIcon = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#00C896;border:2px solid #0A0F1E;box-shadow:0 0 0 4px #00C89655"></div>`,
  iconAnchor: [8, 8],
})

function DarkTiles() {
  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      maxZoom={18}
    />
  )
}

// Pan/zoom to the estimated train position whenever it changes.
function Recenter({ pos }: { pos: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (pos) map.setView(pos, 14, { animate: true })
  }, [pos?.[0], pos?.[1]]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

interface Props {
  prediction: PredictionResult
  selectedTrainNo?: string | null
}

const { latitude, longitude, stationA, stationB } = KAGGADASAPURA
const CROSS: [number, number] = [latitude, longitude]
const BYPL_COORD: [number, number] = [12.9905, 77.6668]
const BLRR_COORD: [number, number] = [12.9386, 77.7086]

const lerp = (a: [number, number], b: [number, number], f: number): [number, number] => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
]

export function CrossingMap({ prediction, selectedTrainNo }: Props) {
  // Prefer the tapped train (from the 3-hour schedule); else the next one.
  const selected = selectedTrainNo
    ? prediction.scheduleTrains.find((t) => t.trainNo === selectedTrainNo)
    : undefined
  const train: ApproachingTrain | null = selected ?? prediction.approachingTrains[0] ?? null

  // Estimated position: fraction of the way from the train's source station to the crossing.
  const src = train ? (train.direction === 'AtoB' ? BYPL_COORD : BLRR_COORD) : null
  const f = train ? Math.max(0, Math.min(1, train.progressToCrossing)) : 0
  const trainPos: [number, number] | null = train && src ? lerp(src, CROSS, f) : null

  return (
    <div className="p-4">
      <div className="text-[10px] font-medium tracking-widest uppercase text-[#5E7090] mb-3">
        Track layout
      </div>

      <div className="rounded-xl overflow-hidden border border-[#3A4F6A]" style={{ height: 280 }}>
        <MapContainer
          center={trainPos ?? CROSS}
          zoom={13}
          style={{ height: '100%', width: '100%', background: '#0A0F1E' }}
          zoomControl={false}
        >
          <DarkTiles />
          <Recenter pos={trainPos} />

          {/* Schematic line: BYPL — crossing — BLRR (straight, not exact track) */}
          <Polyline positions={[BYPL_COORD, CROSS, BLRR_COORD]} pathOptions={{ color: '#3A4F6A', weight: 2, dashArray: '4 6' }} />

          <Marker position={CROSS} icon={crossingIcon}>
            <Popup>Kaggadasapura crossing · {prediction.state}</Popup>
          </Marker>
          <Marker position={BYPL_COORD} icon={makeIcon('#5E7090', 14)}>
            <Popup>{stationA.name} ({stationA.code})</Popup>
          </Marker>
          <Marker position={BLRR_COORD} icon={makeIcon('#5E7090', 14)}>
            <Popup>{stationB.name} ({stationB.code})</Popup>
          </Marker>

          {train && trainPos && (
            <Marker position={trainPos} icon={trainIcon}>
              <Popup>
                <b>{train.trainNo}</b> {train.trainName}
                <br />
                est. {Math.round(f * 100)}% from {train.sourceCode} to crossing
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {[
          { color: '#F5A623', label: 'Crossing' },
          { color: '#5E7090', label: 'Station' },
          { color: '#00C896', label: 'Train (est.)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-[#5E7090]">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      {train ? (
        <div className="mt-3 rounded-xl border border-[#3A4F6A] bg-[#1A2332] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#C8D6E8]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {train.trainNo} · {train.trainName}
              </div>
              <div className="text-[11px] text-[#5E7090] mt-0.5">
                {train.direction === 'AtoB'
                  ? `${stationA.code} → Crossing → ${stationB.code}`
                  : `${stationB.code} → Crossing → ${stationA.code}`}
              </div>
            </div>
            <div
              className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
              style={{ background: 'rgba(245,166,35,0.1)', color: '#F5A623', border: '1px solid rgba(245,166,35,0.25)', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {train.etaSeconds < 0 ? 'crossed' : `~${Math.max(0, Math.round(train.etaSeconds / 60))} min`}
            </div>
          </div>
          <div className="text-[11px] text-[#7C8CA5] mt-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {f >= 1
              ? 'at / just past the crossing'
              : f <= 0
              ? `still around ${train.sourceCode}`
              : `est. ${Math.round(f * 100)}% of the way from ${train.sourceCode} to the crossing`}
            {' · crosses ~'}{formatTime(train.crossingAt)}
          </div>
          <div className="text-[10px] text-[#3A4F6A] mt-1.5">
            Estimated from schedule + delay — not live GPS.
          </div>
        </div>
      ) : (
        <div className="mt-3 text-center text-[#5E7090] text-sm py-4">No train to show right now.</div>
      )}
    </div>
  )
}

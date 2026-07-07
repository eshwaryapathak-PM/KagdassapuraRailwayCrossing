import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { KAGGADASAPURA } from '../lib/config'
import type { PredictionResult } from '../types'

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

function DarkTiles() {
  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      attribution='&copy; <a href="https://carto.com/">CARTO</a>'
      maxZoom={18}
    />
  )
}

interface Props {
  prediction: PredictionResult
}

const { latitude, longitude, stationA, stationB } = KAGGADASAPURA

// Approximate station coordinates
const BYPL_COORD: [number, number] = [12.9905, 77.6668]
const BLRR_COORD: [number, number] = [12.9386, 77.7086]

export function CrossingMap({ prediction }: Props) {
  const firstTrain = prediction.approachingTrains[0]

  return (
    <div className="p-4">
      <div className="text-[10px] font-medium tracking-widest uppercase text-[#5E7090] mb-3">
        Track layout
      </div>

      <div className="rounded-xl overflow-hidden border border-[#3A4F6A]" style={{ height: 280 }}>
        <MapContainer
          center={[latitude, longitude]}
          zoom={13}
          style={{ height: '100%', width: '100%', background: '#0A0F1E' }}
          zoomControl={false}
        >
          <DarkTiles />

          {/* Crossing */}
          <Marker position={[latitude, longitude]} icon={crossingIcon}>
            <Popup>
              <b>Kaggadasapura Crossing Status</b>
              <br />
              Status: {prediction.state}
            </Popup>
          </Marker>

          {/* BYPL */}
          <Marker position={BYPL_COORD} icon={makeIcon('#5E7090', 14)}>
            <Popup>{stationA.name} ({stationA.code})</Popup>
          </Marker>

          {/* BLRR */}
          <Marker position={BLRR_COORD} icon={makeIcon('#5E7090', 14)}>
            <Popup>{stationB.name} ({stationB.code})</Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {[
          { color: '#F5A623', label: 'Crossing' },
          { color: '#5E7090', label: 'Station' },
          { color: '#00C896', label: 'Train (live)' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px] text-[#5E7090]">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Active train card */}
      {firstTrain && (
        <div className="mt-3 rounded-xl border border-[#3A4F6A] bg-[#1A2332] px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-[13px] font-medium text-[#C8D6E8]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {firstTrain.trainNo} · {firstTrain.trainName}
              </div>
              <div className="text-[11px] text-[#5E7090] mt-0.5">
                {firstTrain.direction === 'AtoB'
                  ? `${stationA.code} → Crossing → ${stationB.code}`
                  : `${stationB.code} → Crossing → ${stationA.code}`}
              </div>
            </div>
            <div
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(245,166,35,0.1)',
                color: '#F5A623',
                border: '1px solid rgba(245,166,35,0.25)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              ~{Math.max(0, Math.round(firstTrain.etaSeconds / 60))} min
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from 'react-leaflet'
import { useLiveQuery } from 'dexie-react-hooks'
import 'leaflet/dist/leaflet.css'
import { db, createPin } from './db'
import { useConnectivity } from './useConnectivity'
import { syncNow } from './sync'

const CATEGORIES = {
  'dim-lighting' : {label: 'Dim/ no lighting', color: '#f59e0b'},
  'isolated' : {label: 'Isolated stretch', color: '#f97316'},
  'broken-cctv' : {label: 'Broken CCTV', color: '#eab308'},
  'blocked-path' : {label: 'Blocked Path', color: '#a3a3a3'},
  'harassment' : {label: 'Harassment reported', color: '#ef4444'},
  'theft' : {label: 'Theft', color: '#dc2626'},
  'well-lit' : {label: 'Well Lit', color: '#22c55e'},
  'busy' : {label: 'Busy', color: '#16a34a'},
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng)})
  return null
}

export default function App() {
  const online = useConnectivity()
  const [category, setCategory] = useState('dim-lighting')
  const pins = useLiveQuery(() => db.pins.toArray(), [])
  const pending = useLiveQuery(() => db.outbox.count(), [])

  useEffect(() => {if (online) syncNow() }, [online])

  useEffect(() => {
    if (!online) return
    const id = setInterval(syncNow, 15000)
    return () => clearInterval(id)
  }, [online])

  function handlePick(latlng) {
    const hour = new Date().getHours()
    createPin({
      lat: latlng.lat,
      lng: latling.lng,
      category,
      severity: 2,
      note: '',
      timeOfDay: hour >= 18 || hour < 7 ? 'night' : 'day',
    })
  }

  return (
    <div>
      <h2>SafePath</h2>
      <p>{online ? 'Online' : 'Offline'} | {pending ?? 0} changes waiting</p>

      <label>Pin type: </label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {Object.entries(CATEGORIES).map(([KeyboardEvent, c]) => (
          <option key={key} value={key}>{c.label}</option>
        ))}
      </select>
      <p style={{ fontsize: 13 }}>Tap anywhere on the map to drop a pin.</p>

      <MapContainer center={[18.5204, 73.8567]} zoom={14} style={{ height: '65vh', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={handlePick} />
        {pins?.filter((p) => !p.deleted).map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={10}
            pathOptions={{
              color: CATEGORIES[p.category]?.color,
              fillOpacity: p.syncStatus === 'synced' ? 0.8 : 0.3,
              dashArray: p.syncStatus === 'synced' ? null : '4',
            }}
          >
            <Popup>
              {CATEGORIES[p.category]?.label}<br />
              {p.timeOfDay} | {p.syncStatus}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
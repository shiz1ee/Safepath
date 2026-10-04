import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, useMap } from 'react-leaflet'
import { useLiveQuery } from 'dexie-react-hooks'
import 'leaflet/dist/leaflet.css'
import { db, createPin, updatePin, deletePin, confirmPin, resolveConflict } from './db'
import { useConnectivity } from './useConnectivity'
import { syncNow } from './sync'
import { useProximity } from './useProximity'

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

const label = (x) => CATEGORIES[x.category]?.label || x.category
function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng)})
  return null
}

function Recenter({ position }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (position && !done.current) {
      map.setView([position.lat, position.lng], 16)
      done.current = true
    }
  }, [position, map])
  return null
}

export default function App() {
  const online = useConnectivity()
  const [category, setCategory] = useState('dim-lighting')
  const [alertsOn, setAlertsOn] = useState(false)
  const pins = useLiveQuery(() => db.pins.toArray(), [])
  const pending = useLiveQuery(() => db.outbox.count(), [])
  const conflicts = pins?.filter((p) => p.syncStatus === 'conflict') || []
  const { position, nearby, error: locError } = useProximity(pins, alertsOn)

  useEffect(() => {if (online) syncNow() }, [online])

  useEffect(() => {
    if (!online) return
    const id = setInterval(syncNow, 5000)
    return () => clearInterval(id)
  }, [online])

  async function act(fn) {
  await fn()
  if (online) syncNow()
 }

  function handlePick(latlng) {
    const hour = new Date().getHours()
    act(() => createPin({
      lat: latlng.lat,
      lng: latlng.lng,
      category,
      severity: 2,
      note: '',
      timeOfDay: hour >= 18 || hour < 7 ? 'night' : 'day',
    }))
  }

  return (
    <div>
      <h2>SafePath</h2>
      <p>{online ? 'Online' : 'Offline'} | {pending ?? 0} changes waiting</p>


      <div style={{ margin: 8 }}>
        {!alertsOn ? (
          <button onClick={() => setAlertsOn(true)}> Turn on safety alerts</button>
      ) : locError ? (
        <span>{locError}</span>
      ) : !position ? (
        <span>Finding your location…</span>
      ) : nearby.length === 0 ? (
        <span>No reported hazards within 150 m</span>
      ) : (
        <div style={{ background: '#78350f', padding: 10, borderRadius: 8 }}>
          <b>⚠ {nearby.length} reported hazard(s) within 150 m</b>
          {nearby.slice(0, 3).map((p) => (
            <div key={p.id}>{label(p)} · {p.dist} m away</div>
          ))}
        </div>
      )}
    </div>



      {conflicts.length > 0 && (
  <div style={{ background: '#7f1d1d', padding: 10, margin: 8, borderRadius: 8 }}>
    <b> {conflicts.length} conflict(s) need your decision</b>
    {conflicts.map((p) => (
      <div key={p.id} style={{ marginTop: 10 }}>
        <div>
          <b>Your version:</b>{' '}
          {p.conflictOp === 'delete' ? 'Delete this pin' : label(p)}
        </div>
        <div>
          <b>Server version:</b>{' '}
          {p.serverCopy.deleted
            ? 'Deleted by someone else'
            : `${label(p.serverCopy)} (${p.serverCopy.confirmations || 0} confirmations)`}
        </div>
        <button onClick={() => act(() => resolveConflict(p.id, 'mine'))}>Keep mine</button>{' '}
        <button onClick={() => act(() => resolveConflict(p.id, 'theirs'))}>Keep theirs</button>
      </div>
    ))}
  </div>
)}

      <label>Pin type: </label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <option key={key} value={key}>{c.label}</option>
        ))}
      </select>
      <p style={{ fontSize: 13 }}>Tap anywhere on the map to drop a pin.</p>

      <MapContainer center={[18.5204, 73.8567]} zoom={14} style={{ height: '65vh', width: '100%' }}>
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onPick={handlePick} />
        <Recenter position={position} />
        {position && (
          <CircleMarker center={[position.lat, position.lng]} radius={8}
            pathOptions={{ color: '#3b82f6', fillOpacity: 1 }} />
        )}
        {pins?.filter((p) => !p.deleted).map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={10}
            pathOptions={{
              color: p.syncStatus === 'conflict' ? '#ffff' : CATEGORIES[p.category]?.color ,
              fillOpacity: p.syncStatus === 'synced' ? 0.8 : 0.3,
              dashArray: p.syncStatus === 'synced' ? null : '4',
            }}
          >
            <Popup>
              <b>{label(p)}</b><br />
              {p.timeOfDay} | {p.syncStatus} | seen by {p.confirmations || 0}<br />
              {p.syncStatus === 'conflict' ? (
                <i>Resolve this conflict at the top of the page.</i>
              ) : (
                <>
                  <select
                    value={p.category}
                    onChange={(e) => act(() => updatePin(p.id, { category: e.target.value }))}
                  >
                    {Object.entries(CATEGORIES).map(([key, c]) => (
                      <option key={key} value={key}>{c.label}</option>
                    ))}
                  </select><br />
                  <button onClick={() => act(() => confirmPin(p.id))}>I saw this too</button>{' '}
                  <button onClick={() => act(() => deletePin(p.id))}>Delete</button>
                </>
              )}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMapEvents, useMap } from 'react-leaflet'
import { useLiveQuery } from 'dexie-react-hooks'
import 'leaflet/dist/leaflet.css'
import './safepath.css'
import { db, createPin, updatePin, deletePin, confirmPin, resolveConflict } from './db'
import { useConnectivity } from './useConnectivity'
import { syncNow } from './sync'
import { useProximity } from './useProximity'

const CATEGORIES = {
  'dim-lighting': { label: 'Dim / no lighting', color: '#f59e0b' },
  'isolated': { label: 'Isolated stretch', color: '#f97316' },
  'broken-cctv': { label: 'Broken CCTV', color: '#eab308' },
  'blocked-path': { label: 'Blocked path', color: '#a3a3a3' },
  'harassment': { label: 'Harassment reported', color: '#ef4444' },
  'theft': { label: 'Theft', color: '#dc2626' },
  'well-lit': { label: 'Well lit', color: '#22c55e' },
  'busy': { label: 'Busy', color: '#16a34a' },
}

const label = (x) => CATEGORIES[x.category]?.label || x.category

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng) })
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

function SmoothDot({ position }) {
  const [shown, setShown] = useState(null)
  const shownRef = useRef(null)
  const map = useMap()

  useEffect(() => {
    if (!position) return
    if (!shownRef.current) {
      shownRef.current = { lat: position.lat, lng: position.lng }
      setShown(shownRef.current)
      return
    }
    const from = { ...shownRef.current }
    const start = performance.now()
    const dur = 900
    let raf
    const step = (now) => {
      const t = Math.min((now - start) / dur, 1)
      const cur = {
        lat: from.lat + (position.lat - from.lat) * t,
        lng: from.lng + (position.lng - from.lng) * t,
      }
      shownRef.current = cur
      setShown(cur)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [position])

  useEffect(() => {
    if (shown && !map.dragging._draggable?._moving) {
      map.panTo([shown.lat, shown.lng], { animate: false })
    }
  }, [shown, map])

  if (!shown) return null
  return (
    <>
      {position?.acc && (
        <Circle center={[shown.lat, shown.lng]} radius={position.acc}
          pathOptions={{ color: '#3b82f6', weight: 1, fillOpacity: 0.1 }} />
      )}
      <CircleMarker center={[shown.lat, shown.lng]} radius={8}
        pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }} />
    </>
  )
}

function ResizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

export default function App() {
  const online = useConnectivity()
  const [category, setCategory] = useState('dim-lighting')
  const [alertsOn, setAlertsOn] = useState(true)
  const [full, setFull] = useState(false)
  const [showGuide, setShowGuide] = useState(() => !localStorage.getItem('guideSeen'))
  const mapWrapRef = useRef(null)
  const pins = useLiveQuery(() => db.pins.toArray(), [])
  const pending = useLiveQuery(() => db.outbox.count(), [])
  const conflicts = pins?.filter((p) => p.syncStatus === 'conflict') || []
  const { position, nearby, error: locError } = useProximity(pins, alertsOn)

  useEffect(() => {
    if (online) syncNow()
  }, [online])

  useEffect(() => {
    if (!online) return
    const id = setInterval(syncNow, 5000)
    return () => clearInterval(id)
  }, [online])

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setFull(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setFull(false)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  function toggleFull() {
    const next = !full
    setFull(next)
    const el = mapWrapRef.current
    try {
      if (next && el && el.requestFullscreen) {
        el.requestFullscreen().catch(() => {})
      } else if (!next && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    } catch {
      // the page-level full screen still works without the browser API
    }
  }

  async function act(fn) {
    await fn()
    if (online) syncNow()
  }

  function closeGuide() {
    localStorage.setItem('guideSeen', '1')
    setShowGuide(false)
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
    <div className="app">
      <header className="topbar">
        <div className="brand">SafePath</div>
        <div className={`pill ${online ? 'on' : 'off'}`}>
          {online
            ? (pending ? `Syncing ${pending}...` : 'All synced')
            : `Offline - ${pending ?? 0} saved on device`}
        </div>
        <button className="icon-btn" onClick={() => setShowGuide(true)} title="How it works">?</button>
      </header>

      <div className="alertbar">
        {!alertsOn ? (
          <button onClick={() => setAlertsOn(true)}>Turn on safety alerts</button>
        ) : locError ? (
          <span>{locError}</span>
        ) : !position ? (
          <span>Finding your location...</span>
        ) : nearby.length === 0 ? (
          <span>No reported hazards within 150 m</span>
        ) : (
          <div className="warn">
            <b>{nearby.length} reported hazard(s) within 150 m</b>
            {nearby.slice(0, 3).map((p) => (
              <div key={p.id}>{label(p)} - {p.dist} m away</div>
            ))}
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="conflict">
          <b>{conflicts.length} conflict(s) need your decision</b>
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

      <div className="toolbar">
        <label>Next pin type:</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {Object.entries(CATEGORIES).map(([key, c]) => (
            <option key={key} value={key}>{c.label}</option>
          ))}
        </select>
        <p className="hint">Tap the map to drop a pin of this type. Tap an existing pin to edit, confirm or delete it.</p>
      </div>

      <div className={`mapwrap${full ? ' full' : ''}`} ref={mapWrapRef}>
        <MapContainer center={[18.5204, 73.8567]} zoom={14} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={handlePick} />
          <Recenter position={position} />
          <ResizeWatcher />
          <SmoothDot position={position} />
          {pins?.filter((p) => !p.deleted).map((p) => (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lng]}
              radius={10}
              pathOptions={{
                color: p.syncStatus === 'conflict' ? '#ffffff' : CATEGORIES[p.category]?.color,
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

        <button className="fs-btn" onClick={toggleFull}>
          {full ? 'Exit full screen' : 'Full screen'}
        </button>

        {full && (
          <select className="fs-type" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORIES).map(([key, c]) => (
              <option key={key} value={key}>{c.label}</option>
            ))}
          </select>
        )}
      </div>

      {showGuide && (
        <div className="overlay" onClick={closeGuide}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>How SafePath works</h3>
            <ol>
              <li><b>Drop a pin.</b> Pick a type, then tap the map to mark an unsafe or safe spot. No account needed.</li>
              <li><b>Works without signal.</b> Pins save on your phone first. A faded pin is waiting to upload, and a solid pin is synced.</li>
              <li><b>Syncs safely.</b> When you are back online, your changes upload and other people's pins arrive. If two people edit the same pin offline, you choose which version to keep, so nothing is overwritten silently.</li>
              <li><b>Safety alerts.</b> Turn them on to get a warning when you are within 150 m of a reported hazard.</li>
            </ol>
            <div className="legend">
              {Object.values(CATEGORIES).map((c) => (
                <span key={c.label}><i style={{ background: c.color }} /> {c.label}</span>
              ))}
            </div>
            <button className="primary" onClick={closeGuide}>Got it</button>
          </div>
        </div>
      )}
    </div>
  )
}
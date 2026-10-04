import {useState, useEffect} from 'react'
import {useLiveQuery} from 'dexie-react-hooks'
import { db, createPin} from './db'

export default function App() {
  const [online, setOnline] = usestate(navigator.online)
  const pins = useLiveQuery(() => db.pins.toArray(), [])
  const pending = useLiveQuery(() => db.outbox.count(), [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return (
    <div style={{ padding: 20}}>
      <h1>Safe Path</h1>
      <p>{online ? 'Online' : 'Offline'} | {pending ?? 0} changes waiting</p>
      <button onClick={() => createPin({
        lat: 18.52, lng: 73.85,
        category: 'dim-lighting', severity: 2, note: 'test', timeOfDay: 'night',
      })}>Add test pin</button>
      <ul>
        {pins?.map(p => <li key={p.id}>{p.category} ({p.syncStatus})</li>)}
      </ul>
    </div>
  )
}
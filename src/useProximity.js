import { useEffect, useRef, useState } from 'react'

const UNSAFE = ['dim-lighting', 'isolated', 'broken-cctv', 'blocked-path', 'harassment', 'theft']
const RADIUS = 150 // metres

function distance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function useProximity(pins, enabled) {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState('')
  const alerted = useRef(new Set())

  useEffect(() => {
    if (!enabled) return
    if (!navigator.geolocation) {
      setError('Location is not supported on this device')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError('')
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude })
      },
      (e) => setError(e.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])

  const nearby =
    position && pins
      ? pins
          .filter((p) => !p.deleted && UNSAFE.includes(p.category))
          .map((p) => ({ ...p, dist: Math.round(distance(position.lat, position.lng, p.lat, p.lng)) }))
          .filter((p) => p.dist <= RADIUS)
          .sort((a, b) => a.dist - b.dist)
      : []

  // vibrate once for each newly-nearby pin
  useEffect(() => {
    const fresh = nearby.filter((p) => !alerted.current.has(p.id))
    if (fresh.length) {
      fresh.forEach((p) => alerted.current.add(p.id))
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    }
  })

  return { position, nearby, error }
}
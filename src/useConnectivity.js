import {useState, useEffect} from 'react'

export function useConnectivity() {
    const [online, setOnline] = useState(navigator.onLine)

    useEffect(() => {
        let cancelled = false
        async function check() {
            try {
                const res = await fetch('/api/ping?t=' + Date.now(), { cache: 'no-store' })
                if (!cancelled) setOnline(res.ok)
            } catch {
              if (!cancelled) setOnline(false)
            }
        }

        const goOffline = () => setOnline(false)
        check()
        const id = setInterval(check, 5000)
        window.addEventListener('online', check)
        window.addEventListener('offline', goOffline)

        return () => {
            cancelled = true
            clearInterval(id)
            window.removeEventListener('online', check)
            window.removeEventListener('offline', goOffline)
        }
    }, [])
    return online
}
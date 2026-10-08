import { db } from './db'

let syncing = false

export async function syncNow() {
    if (syncing) return
    syncing = true
    try {
        //pushing the pending changes 
        const ops = await db.outbox.orderBy('seq').toArray()
        if (ops.length) {
            const res = await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json'},
                body: JSON.stringify({
                    ops: ops.map(({ opId, pinId, op, data, baseVersion }) => ({
                        opId, pinId, op, data, baseVersion,
                    })),
                }),
            })
            if (!res.ok) throw new Error('sync failed')
            const { results } = await res.json()

            for (const r of results) {
                const entry = ops.find((o) => o.opId === r.opId)
                if (!entry) continue
                await db.transaction('rw', db.pins, db.outbox, async () => {
                    if (r.status === 'ok') {
                        await db.pins.put({ ...r.pin, syncStatus: 'synced' })
                    } else if (r.status === 'conflict') {
                        await db.pins.update(entry.pinId, { 
                            syncStatus: 'conflict',
                            serverCopy: r.pin,
                            localChanges: entry.data,
                            conflictOp: entry.op,
                        })
                    }
                    await db.outbox.delete(entry.seq)
                })
            }
        }

        //pulling other users pin data syncronization
        const since = Number(localStorage.getItem('lastRev') || 0)
        const res2 = await fetch('/api/pins?since=' + since)
        if (!res2.ok) throw new Error('pull request failed')
        const {pins, rev } = await res2.json()
        for (const p of pins) {
            const local = await db.pins.get(p.id)
            if (local && local.syncStatus !== 'synced') continue
            await db.pins.put({ ...p, syncStatus: 'synced'})
        }
        localStorage.setItem('lastRev', String(rev))
    } catch (e) {
        console.log('sync will retry: ', e.message)
    } finally {
        syncing = false
    }
}

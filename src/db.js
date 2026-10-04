import Dexie from 'dexie'

export const db = new Dexie('safepath')

db.version(1).stores({
    pins: 'id, category, updatedAt, syncStatus',
    outbox: '++seq, opId, pinId, createdAt',
})

//pin: saving and queuing it for syns note. in onie go
export async function createPin(data) {
    const now = Date.now()
    const pin = {
        id: crypto.randomUUID(),
        ...data,
        version: 0,
        deleted: false,
        confirmation: 0,
        syncStatus: 'pending',
        createdAt: now,
        updatedAt: now,
    }
    await db.transaction('rw', db.pins, db.outbox, async () => {
        await db.pins.add(pin)
        await db.outbox.add({
            opId: crypto.randomUUID(),
            pinId: pin.id,
            op: 'create',
            data: pin,
            baseVersion: 0,
            createdAt: now,
        })
    })
    return pin
}
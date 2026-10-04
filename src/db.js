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
        confirmations: 0,
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

export async function updatePin(id, changes) {
    const now = Date.now()
    await db.transaction('rw', db.pins, db.outbox, async () => {
        const pin = await db.pins.get(id)
        if (!pin || pin.syncStatus === 'conflict') return
        const ops = await db.outbox.where('pinId').equals(id).toArray()
        const pendingCreate = ops.find((o) => o.op === 'create')
        const pendingUpdate = ops.find((o) => o.op === 'update')

        if (pendingCreate) {
            await db.outbox.update(pendingCreate.seq, { data: { ...pendingCreate.data, ...changes } })
        } else if (pendingUpdate) {
            await db.outbox.update(pendingUpdate.seq, { data: { ...pendingUpdate.data, ...changes } })
        } else {
            await db.outbox.add({
                opId: crypto.randomUUID(), pinId: id, op: 'update',
                data: changes, baseVersion: pin.version, createdAt: now,
            })
        }
        await db.pins.update(id, { ...changes, syncStatus: 'pending', updatedAt: now })
    })
}

export async function deletePin(id) {
    const now = Date.now()
    await db.transaction('rw', db.pins, db.outbox, async () => {
        const pin = await db.pins.get(id)
        if (!pin || pin.syncStatus === 'conflict') return
        const ops = await db.outbox.where('pinId').equals(id).toArray()
        await db.outbox.where('pinId').equals(id).delete()
        if (ops.some((o) => o.op === 'create')) {
            await db.pins.delete(id)
            return
        }
        await db.outbox.add({
            opId: crypto.randomUUID(), pinId: id, op: 'delete',
            data: {}, baseVersion: pin.version, createdAt: now,
        })
        await db.pins.update(id, { deleted: true, syncStatus: 'pending', updatedAt: now })
    })
}
export async function confirmPin(id) {
    await db.transaction('rw', db.pins, db.outbox, async () => {
        const pin = await db.pins.get(id)
        if (!pin || pin.version === 0 || pin.syncStatus === 'conflict') return
        await db.outbox.add({
            opId: crypto.randomUUID(), pinId: id, op: 'confirm',
            data: {}, baseVersion: pin.version, createdAt: Date.now(),
        })
        await db.pins.update(id, {
            confirmations: (pin.confirmations || 0) + 1,
            syncStatus: 'pending',
        })
    })
}

export async function resolveConflict(id, keep) {
    await db.transaction('rw', db.pins, db.outbox, async () => {
        const pin = await db.pins.get(id)
        if (!pin || pin.syncStatus !== 'conflict') return
        const theirs = pin.serverCopy

        if (keep === 'theirs') {
            await db.pins.put({ ...theirs, syncStatus: 'synced' })
            return
        }

        const op = pin.conflictOp
        await db.outbox.add({
            opId: crypto.randomUUID(), pinId: id, op,
            data: pin.localChanges || {}, baseVersion: theirs.version, createdAt: Date.now(),
        })
        const { serverCopy, localChanges, conflictOp, ...mine } = pin
        await db.pins.put({
            ...mine,
            deleted: op === 'delete',
            version: theirs.version,
            syncStatus: 'pending',
        })
    })
}
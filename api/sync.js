import { loadStore, saveStore } from './_store.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const store = await loadStore()
    const results = []

    for (const o of req.body?.ops || []) {
      if (store.ops[o.opId]) { results.push(store.ops[o.opId]); continue }

      const { syncStatus, serverCopy, ...clean } = o.data || {}
      const cur = store.pins[o.pinId]
      let result

      if (o.op === 'create') {
        if (!cur) store.pins[o.pinId] = { ...clean, version: 1, rev: ++store.rev }
        result = { opId: o.opId, status: 'ok', pin: store.pins[o.pinId] }
      } else if (!cur) {
        result = { opId: o.opId, status: 'rejected' }
      } else if (o.op === 'confirm') {
        cur.confirmations = (cur.confirmations || 0) + 1
        cur.rev = ++store.rev
        result = { opId: o.opId, status: 'ok', pin: cur }
      } else if (o.baseVersion !== cur.version) {
        result = { opId: o.opId, status: 'conflict', pin: cur }
      } else if (o.op === 'update') {
        Object.assign(cur, clean, { id: cur.id, deleted: false, version: cur.version + 1, rev: ++store.rev })
        result = { opId: o.opId, status: 'ok', pin: cur }
      } else {
        cur.deleted = true
        cur.version += 1
        cur.rev = ++store.rev
        result = { opId: o.opId, status: 'ok', pin: cur }
      }

      store.ops[o.opId] = result
      results.push(result)
    }

    await saveStore(store)
    res.status(200).json({ results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
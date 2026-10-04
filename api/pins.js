import { loadStore } from './_store.js'

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store')
    const store = await loadStore()
    const since = Number(req.query.since || 0)
    res.status(200).json({
      rev: store.rev,
      pins: Object.values(store.pins).filter((p) => p.rev > since),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
import express from 'express'
import fs from 'fs'

const FILE = 'server/data.json'
let store = { rev: 0, pins: {}, ops: {} }
if (fs.existsSync(FILE)) store = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const save = () => fs.writeFileSync(FILE, JSON.stringify(store))

const app = express()
app.use(express.json({ limit: '5mb'}))

app.get('/api/ping', (req, res) => res.JSON({ ok: true }))

app.get('/api/pins', (req, res) => {
    const since = Number(req.query.since || 0)
    res.json({
        rev: store.rev,
        pins: Object.values(store.pins).filter((p) => p.rev > since),
    })
})

app.post('/api/sync', (req, res) => {
    const results = []
    for (const o of req.body.ops || []) {
        //Idempotency 
        if (store.ops[o.opId]) { results.push(store.ops[o.opId]); continue}

        const { syncStatus, serverCopy, ...clean } = o.data || {}
        const cur = store.pins[o.pinId]
        let result
        
        if (o.op === 'create') {
            if (!cur) store.pins[o.pinId] = { ...clean, version: 1, rev: ++store.rev }
            result = {opId: o.opId, status: 'ok', pin: store.pins[o.pinId] }
        }else if (!cur) {
            result = { opId: o.opId, status: 'rejected'}
        }else if (o.op === 'confirm') {
            //confirmations alwayss tend to merge so its not an issue for conflict, so idts the error is here
            cur.confirmations = (cur.confirmations || 0) + 1
            cur.rev = ++store.rev
            result = { opId: o.opId, status: 'ok', pin: cur }
        } else if (o.baseVersion !== cur.version) {
            result = { opId: o.opId, status: 'conflict', pin: cur}
        }else if (o.op === 'update') {
            Object.assign(cur, clean, { id: cur.id, version: cur.version + 1, rev: ++store.rev })
            result = {opId: o.opId, status: 'ok', pin: cur }
        } else {
            cur.deleted = true
            cur.version += 1
            cur.rev = ++store.rev
            result = {opId: o.opId, status: 'ok', pin: cur}
        }

        store.ops[o.opId] = result
        results.push(result)
    }
    save()
    res.json({ results })
})

app.use(express.static('dist'))
app.listen(process.env.PORT || 3001, () => console.log('server on 3001'))
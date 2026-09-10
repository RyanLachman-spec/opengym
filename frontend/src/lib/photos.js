// Progress photos: device-only, never synced. They live in IndexedDB rather than the synced
// JSON state (S) for two reasons — a handful of photos would balloon the JSON backup from a
// few KB to tens of MB, and a photo is exactly the kind of thing that should NOT silently
// leave the device it was taken on just because the profile happens to be signed in. A photo
// taken on a phone stays on that phone; it's a deliberate trade-off, not a limitation to fix.
import { uid } from './format.js'

const DB_NAME = 'opengym-photos'
const STORE = 'photos'
const VERSION = 1

let dbPromise = null
function openDb() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('IndexedDB not available'))
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

const tx = (db, mode) => db.transaction(STORE, mode).objectStore(STORE)

/** Store a photo blob against an ISO date. Returns the new photo's id. */
export async function addPhoto(blob, d) {
  const db = await openDb()
  const rec = { id: uid(), d, blob, createdAt: Date.now() }
  await new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put(rec)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
  return rec.id
}

/** Every stored photo, most recent first. */
export async function listPhotos() {
  const db = await openDb()
  const all = await new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return sortPhotos(all)
}

export function sortPhotos(list) {
  return [...list].sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : b.createdAt - a.createdAt))
}

export async function deletePhoto(id) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Service layer for mail item API calls.
 * All fetch logic lives here — UI components import these functions,
 * never call fetch() directly, making them unit-testable without heavy mocking.
 */

async function unwrap(res: Response): Promise<void> {
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(d.error ?? '操作失敗')
  }
}

export const mailApi = {
  notify: async (itemId: number): Promise<void> => {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId }),
    })
    await unwrap(res)
  },

  put: async (id: number, body: Record<string, unknown>): Promise<void> => {
    const res = await fetch(`/api/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await unwrap(res)
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
    await unwrap(res)
  },

  uploadPhoto: async (file: File): Promise<string> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    if (!res.ok) throw new Error('照片上傳失敗')
    const data = await res.json()
    return data.savedPath as string
  },

  ocr: async (file: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/ocr', { method: 'POST', body: fd })
    if (!res.ok) return null
    const data = await res.json()
    return data.rawText ?? null
  },
}

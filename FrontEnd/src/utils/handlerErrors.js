export async function extractServerMessage(res) {
    try {
        const contentType = res.headers.get('Content-Type') || ''
        if (contentType.includes('application/json')) {
            const data = await res.json()
            return data?.message || data?.error || ''
        }
        const text = await res.text()
        return (text || '').slice(0, 500)
    } catch {
        return ''
    }
}

export function mapFetchError({ res, serverMessage, error }) {
    // Ветка ответа сервера (!res.ok)
    if (res) {
        if (res.status === 401 || res.status === 403) return 'Please sign in'
        if (res.status === 404) return serverMessage || 'Not found'
        if (res.status === 429) return 'Too many requests. Please try again later'
        if (res.status >= 500) return 'Server error. Please try again later'
        return serverMessage || 'Something went wrong'
    }
    // Ветка исключений (сетевые/другие)
    if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) {
        return 'Network error. Check your connection and try again'
    }
    if (error?.name === 'TypeError') {
        return 'Network error. Check your connection and try again'
    }
    return error?.message || 'Unexpected error'
}
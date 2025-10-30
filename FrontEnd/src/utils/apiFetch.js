export async function apiFetch(url, opts = {}) {
    const {
        method = 'GET',
        body,
        headers = {},
        ...rest
    } = opts

    const init = {
        method,
        credentials: 'include',
        headers: {
            ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
        },
        ...rest,
    }

    if (body !== undefined) {
        if (body instanceof FormData) {
            init.body = body
        } else {
            init.body = typeof body === 'string' ? body : JSON.stringify(body)
        }
    }

    const res = await fetch(url, init)
    const isJson = res.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await res.json().catch(() => null) : await res.text()

    if (!res.ok) {
        const message = (data && (data.message || data.error)) || res.statusText || 'Request failed'
        const err = new Error(message)
        err.status = res.status
        err.data = data
        throw err
    }
    return data
}
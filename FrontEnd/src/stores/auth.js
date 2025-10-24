import {defineStore} from 'pinia'

async function safeJson(res) {
    const ct = res.headers.get('Content-Type') || ''
    if (ct.includes('application/json')) {
        const text = await res.text()
        if (text) return JSON.parse(text)
    }
    return null
}

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null,
        loading: false,
    }),
    getters: {
        isAuthenticated: (state) => !!state.user,
    },
    actions: {
        async checkAuth() {
            // основной и запасной эндпоинт
            const tryEndpoints = ['/api/users', '/api/users/check']

            for (const url of tryEndpoints) {
                try {
                    const res = await fetch(url, { method: 'GET', credentials: 'include' })
                    if (res.ok) {
                        this.user = await safeJson(res) // { id, login, name, email, about, avatarUrl }
                        return true
                    }
                } catch (_) {
                }
            }

            this.user = null
            return false
        },

        async login({ login, password }) {
            this.loading = true
            try {
                const res = await fetch('/api/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ login, password }),
                })
                const data = await safeJson(res)
                if (!res.ok) {
                    return { ok: false, message: data?.message || 'Login failed' }
                }
                // После успешного входа — подтянуть профиль в стор
                await this.checkAuth()
                return { ok: true }
            } catch (e) {
                return { ok: false, message: e.message }
            } finally {
                this.loading = false
            }
        },

        async register({ login, password }) {
            this.loading = true
            try {
                const res = await fetch('/api/users/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login, password }),
                })
                const data = await safeJson(res)
                if (!res.ok) {
                    return { ok: false, message: data?.message || 'Registration failed' }
                }
                await this.checkAuth()
                return { ok: true }
            } catch (e) {
                return { ok: false, message: e.message }
            } finally {
                this.loading = false
            }
        },

        async logout() {
            try {
                await fetch('/api/users/logout', {
                    method: 'POST',
                    credentials: 'include',
                })
            } finally {
                this.user = null
            }
        },
    },
})


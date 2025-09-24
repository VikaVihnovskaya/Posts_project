import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: null
    }),

    actions: {
        async checkAuth() {
            try {
                const res = await fetch('/api/users/me', {
                    method: 'GET',
                    credentials: 'include' // важный флаг для отправки cookie
                })

                if (!res.ok) {
                    this.user = null
                    return false
                }

                const data = await res.json()
                this.user = data
                return true
            } catch (err) {
                console.error('Auth check failed', err)
                this.user = null
                return false
            }
        },

        async logout() {
            await fetch('/api/users/logout', {
                method: 'POST',
                credentials: 'include'
            })

            this.user = null
        }
    }
})

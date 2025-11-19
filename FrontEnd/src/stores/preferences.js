import { defineStore } from 'pinia'

async function jsonOrThrow(res) {
    const isJson = res.headers.get('content-type')?.includes('application/json')
    const data = isJson ? await res.json().catch(() => null) : null
    if (!res.ok) {
        const message = (data && (data.message || data.error)) || res.statusText
        const err = new Error(message)
        err.status = res.status
        err.data = data
        throw err
    }
    return data
}

export const usePreferencesStore = defineStore('preferences', {
    state: () => ({
        categories: [],          // [{ _id, name, ... }]
        selectedCategoryIds: [], // предпочтения пользователя
        loading: false,
        saving: false,
        error: '',
    }),
    actions: {
        async init() {
            this.loading = true; this.error = ''
            try {
                // Загружаем категории и текущие предпочтения
                const [catsRes, prefsRes] = await Promise.all([
                    fetch('/api/categories?limit=200&page=1', { credentials: 'include' }),
                    fetch('/api/users/preferences', { credentials: 'include' }),
                ])
                this.categories = await jsonOrThrow(catsRes)
                this.selectedCategoryIds = await jsonOrThrow(prefsRes)
            } catch (e) {
                this.error = e.message
            } finally {
                this.loading = false
            }
        },
        async save(categoryIds = this.selectedCategoryIds) {
            this.saving = true; this.error = ''
            try {
                const res = await fetch('/api/users/preferences', {
                    method: 'PUT',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoryIds }),
                })
                this.selectedCategoryIds = await jsonOrThrow(res)
            } catch (e) {
                this.error = e.message
                throw e
            } finally {
                this.saving = false
            }
        },
        async reset() {
            this.saving = true; this.error = ''
            try {
                const res = await fetch('/api/users/preferences', {
                    method: 'DELETE',
                    credentials: 'include',
                })
                this.selectedCategoryIds = await jsonOrThrow(res) // []
            } catch (e) {
                this.error = e.message
                throw e
            } finally {
                this.saving = false
            }
        }
    }
})
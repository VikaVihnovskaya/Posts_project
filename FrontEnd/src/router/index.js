import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
    { path: '/', name: 'Home', component: () => import('../components/Home.vue') },
    { path: '/register', name: 'RegisterUser', component: () => import('../components/RegisterUser.vue') },
    { path: '/login', name: 'LoginUser', component: () => import('../components/LoginUser.vue') },
    { path: '/profile', name: 'Profile', component: () => import('../components/Profile.vue'), meta: { requiresAuth: true } },
    { path: '/create', name: 'CreatePost', component: () => import('../components/CreatePost.vue'), meta: { requiresAuth: true } },
    { path: '/posts/:id', name: 'PostView', component: () => import('../components/PostView.vue') },
]

const router = createRouter({
    history: createWebHistory(),
    routes
})
router.beforeEach(async (to) => {
    const auth = useAuthStore()
    if (to.meta.requiresAuth) {
        // Если стор пустой, пробуем проверить сессию
        if (!auth.user) {
            const ok = await auth.checkAuth()
            if (!ok) return '/login'
        }
    }
})
export default router
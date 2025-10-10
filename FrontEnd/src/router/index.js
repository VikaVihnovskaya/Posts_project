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
    // При первом заходе попробуем подтянуть сессию
    if (!auth.user) {
        await auth.checkAuth().catch(() => {})
    }
    if (to.meta.requiresAuth) {
        if (!auth.user) {
            const ok = await auth.checkAuth()
            if (!ok) {
                return { name: 'LoginUser', query: { redirect: to.fullPath } }
            }
        }
    }
    // Если уже авторизован и идёт на login/register — отправим на redirect || /profile
    if ((to.name === 'LoginUser' || to.name === 'RegisterUser') && auth.user) {
        const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : null
        return { path: redirect || '/profile' }
    }
})
export default router
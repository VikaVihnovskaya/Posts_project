import { createRouter, createWebHistory } from 'vue-router'
import RegisterUser from '../components/RegisterUser.vue'
import LoginUser from '../components/LoginUser.vue'
import Profile from '../components/Profile.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'RegisterUser',
    component: RegisterUser
  },
  {
    path: '/login',
    name: 'LoginUser',
    component: LoginUser
  },
    {
        path: '/profile',
        name: 'Profile',
        component: Profile,
        beforeEnter: async (to, from, next) => {
            const authStore = useAuthStore()
            const isAuthenticated = await authStore.checkAuth()
            if (!isAuthenticated) {
                next('/login')
            } else {
                next()
            }
        }
    }
]
const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
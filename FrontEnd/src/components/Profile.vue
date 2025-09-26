<template>
  <div class="profile">
    <h2>👤 Welcome to your profile!</h2>

    <p><strong>ID:</strong> {{ user?.id }}</p>
    <p><strong>User name:</strong> {{ user?.login }}</p>

    <button @click="logout">🚪 Log out</button>
  </div>
</template>

<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { computed } from 'vue'

const authStore = useAuthStore()
const router = useRouter()

const user = computed(() => authStore.user)

const logout = () => {
  authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.profile {
  max-width: 400px;
  margin: 2rem auto;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
}
button {
  margin-top: 1rem;
  padding: 6px 12px;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background: #d64545;
}
</style>

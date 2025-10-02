<template>

  <div class="profile">
    <header class="topbar">
      <router-link class="btn outline" to="/">← Home</router-link>
      <router-link class="btn" to="/create">Create Post</router-link>
      <button @click="logout">Log out</button>
    </header>
    <h2>👤 Welcome to your profile!</h2>

    <p><strong>ID:</strong> {{ user?.id }}</p>
    <p><strong>User name:</strong> {{ user?.login }}</p>

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
  max-width: 1200px;
  margin: 1rem auto;
  padding: 0 1rem;

}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.btn {
  padding: 6px 12px;
  background: #42b883;
  color: #fff;
  border: none;
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
  transition: background .2s ease-in-out;
}
.btn:hover {
  background: #2a9d6f;
}
button {
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

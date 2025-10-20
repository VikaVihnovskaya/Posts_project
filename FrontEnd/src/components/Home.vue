<template>
  <div class="home">
    <header class="topbar">
      <div class="auth-actions">
        <template v-if="isAuth">
          <router-link class="btn" to="/profile">Profile</router-link>
          <router-link class="btn" to="/create">Create Post</router-link>
          <button class="btn outline" @click="onLogout">Log out</button>
        </template>
        <template v-else>
          <router-link class="btn" to="/login">Login</router-link>
          <router-link class="btn outline" to="/register">Register</router-link>
        </template>
      </div>
    </header>
    <h1>Welcome to the list of posts! </h1>
    <section class="feed" v-if="items.length">
      <PostCard v-for="post in items" :key="post._id" :post="post" />
    </section>

    <section v-else class="empty">
      <p v-if="loading">Loading…</p>
      <p v-else>Post List is empty</p>
    </section>

    <footer class="pager" v-if="total > 0">
      <button class="btn outline" :disabled="page === 0 || loading" @click="prevPage">Back</button>
      <span>Page {{ page + 1 }} of {{ totalPages }}</span>
      <button class="btn outline" :disabled="page >= totalPages - 1 || loading" @click="nextPage">Next</button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import PostCard from './PostCard.vue'

const auth = useAuthStore()
const isAuth = computed(() => !!auth.user)

const items = ref([])
const loading = ref(false)
const error = ref('')
// Пагинация
const page = ref(0)
const limit = ref(10)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/posts?limit=${limit.value}&page=${page.value}`, {
      credentials: 'include',
    })

    if (!res.ok) {
      error.value = 'Failed to load posts'
      items.value = []
      total.value = 0
      return
    }
    const data = await res.json()
    items.value = Array.isArray(data.items) ? data.items : []
    total.value = data.total || 0
  } catch (e) {
    error.value = e.message || 'Error loading posts'
    items.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function nextPage() {
  if (page.value < totalPages.value - 1) {
    page.value += 1
  }
}
function prevPage() {
  if (page.value > 0) {
    page.value -= 1
  }
}
async function onLogout() {
  await auth.logout()
  await load()
}

onMounted(async () => {
  if (!auth.user) {
    await auth.checkAuth()
  }
  await load()
})
watch(page, load)
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 1rem auto;
  padding: 0 1rem;
}
.topbar {
  display: flex;
  justify-content: end;
  align-items: center;
  margin-bottom: 1rem;
}
.auth-actions {
  display: flex;
  gap: .5rem;
  align-items: center;
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
.btn.outline {
  background: transparent;
  color: #2a9d6f;
  border: 1px solid #2a9d6f;
}
.btn.outline:hover {
    background: #2a9d6f;
    color: #fff;
}
.feed {
  display: grid;
  gap: .75rem;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.pager {
  display: flex;
  gap: .75rem;
  align-items: center;
  justify-content: center;
  margin-top: 1rem;
}
.empty {
  text-align: center;
  color: #666;
}
</style>
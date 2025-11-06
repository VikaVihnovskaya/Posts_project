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
    <div class="content">
      <!-- Левая панель фильтрации -->
      <aside class="filters">
        <h3>Filter by date</h3>
        <label class="field">
          <span>From</span>
          <input type="date" v-model="dateFrom" :max="dateTo || undefined" />
        </label>
        <label class="field">
          <span>To</span>
          <input type="date" v-model="dateTo" :min="dateFrom || undefined" />
        </label>
        <div class="filter-actions">
          <button class="btn" :disabled="loading" @click="applyFilters">Apply</button>
          <button class="btn outline" :disabled="loading || (!dateFrom && !dateTo)" @click="resetFilters">Reset</button>
        </div>
      </aside>
      <!-- Правая колонка с лентой -->
      <main class="main">
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
      </main>
   </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import PostCard from './PostCard.vue'

const route = useRoute()
const router = useRouter()
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

// Фильтры дат (строки формата YYYY-MM-DD)
const dateFrom = ref('')
const dateTo = ref('')

// Чтение и запись query
function normalizeQuery(rawQuery) {
  const query = { ...rawQuery }

  const parsedPage = Number.parseInt(query.page, 10)
  const parsedLimit = Number.parseInt(query.limit, 10)

  return {
    // Номер страницы: целое число ≥ 0, по умолчанию 0
    page: Number.isFinite(parsedPage) && parsedPage >= 0 ? parsedPage : 0,

    // Кол-во элементов на странице: 1–100, по умолчанию 10
    limit:
        Number.isFinite(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100
            ? parsedLimit
            : 10,

    // Даты фильтрации (если переданы)
    dateFrom: typeof query.dateFrom === 'string' ? query.dateFrom : '',
    dateTo: typeof query.dateTo === 'string' ? query.dateTo : '',
  }
}
// Формируем объект query-параметров для запроса
function buildQuery() {
  const query = {
    page: String(page.value),
    limit: String(limit.value),
  }
  if (dateFrom.value) query.dateFrom = dateFrom.value
  if (dateTo.value) query.dateTo = dateTo.value
  return query
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams(buildQuery())
    const response = await fetch(`/api/posts?${params.toString()}}`, { credentials: 'include' })
    if (!response.ok) {
      error.value = 'Failed to load posts'
      items.value = []
      total.value = 0
      return
    }
    const data = await response.json()
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
watch(
    () => route.query,
    (newQuery) => {
      // Преобразуем строковые query в корректные значения (числа, даты и т.п.)
      const { page: queryPage, limit: queryLimit, dateFrom: queryFrom, dateTo: queryTo } = normalizeQuery(newQuery)
        page.value = queryPage
        limit.value = queryLimit
        dateFrom.value = queryFrom
        dateTo.value = queryTo
        load()
      },
    { immediate: true }
)
async function updateQuery(partial, { replace = false } = {}) {
  const current = normalizeQuery(route.query)
  // Собираем итоговый объект, удаляем пустые
  const next = {
    ...route.query, // сохранить сторонние параметры
    page: String(partial.page ?? current.page),
    limit: String(partial.limit ?? current.limit),
  }
  const startDate = partial.dateFrom ?? current.dateFrom
  const endDate = partial.dateTo ?? current.dateTo
  if (startDate) next.dateFrom = startDate; else delete next.dateFrom
  if (endDate) next.dateTo = endDate; else delete next.dateTo

  // Убираем дубликаты
  const same =
      String(route.query.page ?? '') === String(next.page) &&
      String(route.query.limit ?? '') === String(next.limit) &&
      String(route.query.dateFrom ?? '') === String(next.dateFrom ?? '') &&
      String(route.query.dateTo ?? '') === String(next.dateTo ?? '')
  if (same) return

  if (replace) await router.replace({ query: next })
  else await router.push({ query: next })
}
function applyFilters() {
  // При применении фильтра сбрасываем на первую страницу
  updateQuery({ page: 0, dateFrom: dateFrom.value, dateTo: dateTo.value })
}
function resetFilters() {
  updateQuery({ page: 0, dateFrom: '', dateTo: '' })
}

function nextPage() {
  if (page.value < totalPages.value - 1) {
    updateQuery({ page: page.value + 1 })
  }
}

function prevPage() {
  if (page.value > 0) {
    updateQuery({ page: page.value - 1 })
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
  // Инициализация URL дефолтами при первом заходе (без засорения истории)
  const query = normalizeQuery(route.query)
  const needsDefaults = route.query.page === undefined || route.query.limit === undefined
  if (needsDefaults) {
    await updateQuery({ page: query.page, limit: query.limit, dateFrom: query.dateFrom, dateTo: query.dateTo }, { replace: true })
  }
})
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
.content {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 1rem;
}
.filters {
  position: sticky;
  top: 0.5rem;
  align-self: start;
  padding: 0.75rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
}
.filters h3 {
  margin: 0 0 .5rem;
}
.field {
  display: grid;
  grid-template-columns: 1fr;
  gap: .25rem;
  margin-bottom: .75rem;
}
.field input[type="date"] {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.filter-actions {
  display: flex;
  gap: .5rem;
}
.main {
  min-width: 0;
  padding: 0.75rem;
  background: #fafafa;
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
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
        <h3 style="margin-top: 1rem;">Filter by categories</h3>
        <div class="category-list">
          <div v-if="!allCategories.length" class="muted">No categories</div>
          <label v-for="c in allCategories" :key="c._id" class="category-item">
            <input
                type="checkbox"
                v-model="selectedCategoryIds"
                :value="String(c._id)"
            />
            <span>{{ c.name }}</span>
          </label>
        </div>
        <h3 style="margin-top: 1rem;">Filter by tags</h3>
        <div class="tags">
          <div class="chips">
      <span v-for="t in selectedTags" :key="t" class="chip">
        {{ t }}
        <button type="button" class="chip-x" @click="removeTag(t)">×</button>
      </span>
          </div>
          <input
              type="text"
              v-model="tagInput"
              @keydown.enter.prevent="addTag()"
              placeholder="Type tag and press Enter"
          />
          <div class="hint muted">Use Enter to add, or comma to separate multiple tags</div>
        </div>
        <div class="filter-actions">
          <button class="btn" :disabled="loading" @click="applyFilters">Apply</button>
          <button class="btn outline"
                  :disabled="loading || (!dateFrom && !dateTo && !selectedCategoryIds.length && !selectedTags.length)"
                  @click="resetFilters">Reset</button>
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

// Категории
const allCategories = ref([])
const selectedCategoryIds = ref([])
// Тэги
const selectedTags = ref([]) // массив строк тегов
const tagInput = ref('')     // текст в инпуте для добавления

async function loadCategories() {
  try {
    const response = await fetch('/api/categories?limit=200&page=1')
    if (response.ok) {
      allCategories.value = await response.json()
    } else {
      console.warn('Failed to load categories:', response.status)
      allCategories.value = []
    }
  } catch (e) {
    console.warn('Error loading categories:', e)
    allCategories.value = []
  }
}
// Чтение и запись query
function normalizeQuery(rawQuery) {
  const query = { ...rawQuery }

  const parsedPage = Number.parseInt(query.page, 10)
  const parsedLimit = Number.parseInt(query.limit, 10)
  // categories может прийти как строка "id1,id2" или как массив
  const rawCategories = query.categories
  let categories = []
  if (Array.isArray(rawCategories)) {
    categories = rawCategories.map(String)
  } else if (typeof rawCategories === 'string' && rawCategories.trim() !== '') {
    categories = rawCategories.split(',').map(s => s.trim()).filter(Boolean)
  }
  // tags — строка "t1,t2" или массив
  const rawTags = query.tags
  let tags = []
  if (Array.isArray(rawTags)) {
    tags = rawTags.map(String).map(s => s.trim()).filter(Boolean)
  } else if (typeof rawTags === 'string' && rawTags.trim() !== '') {
    tags = rawTags.split(',').map(s => s.trim()).filter(Boolean)
  }
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
    categories,
    tags,
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
  if (selectedCategoryIds.value.length) {
    query.categories = selectedCategoryIds.value.join(',')
  }
  if (selectedTags.value.length) {
    query.tags = selectedTags.value.join(',')
  }
  return query
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams(buildQuery())
    const response = await fetch(`/api/posts?${params.toString()}`, { credentials: 'include' })
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
      const { page: queryPage, limit: queryLimit, dateFrom: queryFrom, dateTo: queryTo, categories, tags } = normalizeQuery(newQuery)
        page.value = queryPage
        limit.value = queryLimit
        dateFrom.value = queryFrom
        dateTo.value = queryTo
        selectedCategoryIds.value = categories
        selectedTags.value = tags
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
  const categories = partial.categories ?? current.categories
  if (categories && categories.length) next.categories = categories.join(','); else delete next.categories
  const tags = partial.tags ?? current.tags
  if (tags && tags.length) next.tags = tags.join(','); else delete next.tags
  // Убираем дубликаты
  const same =
      String(route.query.page ?? '') === String(next.page) &&
      String(route.query.limit ?? '') === String(next.limit) &&
      String(route.query.dateFrom ?? '') === String(next.dateFrom ?? '') &&
      String(route.query.dateTo ?? '') === String(next.dateTo ?? '') &&
      String(route.query.categories ?? '') === String(next.categories ?? '') &&
      String(route.query.tags ?? '') === String(next.tags ?? '')
  if (same) return

  if (replace) await router.replace({ query: next })
  else await router.push({ query: next })
}
function applyFilters() {
  // При применении фильтра сбрасываем на первую страницу
  updateQuery({ page: 0, dateFrom: dateFrom.value, dateTo: dateTo.value, categories: selectedCategoryIds.value, tags: selectedTags.value,})
}
function addTag() {
  const raw = tagInput.value || ''
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean)
  const set = new Set(selectedTags.value)
  for (const p of parts) set.add(p)
  selectedTags.value = Array.from(set)
  tagInput.value = ''
}
function removeTag(t) {
  selectedTags.value = selectedTags.value.filter(x => x !== t)
}
function resetFilters() {
  selectedCategoryIds.value = []
  selectedTags.value = []
  dateFrom.value = ''
  dateTo.value = ''
  updateQuery({ page: 0, dateFrom: '', dateTo: '', categories: [], tags: [] })
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
  await loadCategories()
  // Инициализация URL дефолтами при первом заходе (без засорения истории)
  const query = normalizeQuery(route.query)
  const needsDefaults = route.query.page === undefined || route.query.limit === undefined
  if (needsDefaults) {
    await updateQuery({ page: query.page, limit: query.limit, dateFrom: query.dateFrom, dateTo: query.dateTo, categories: query.categories }, { replace: true })
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
.category-list {
  display: grid;
  gap: 0.25rem;
  margin: 0.5rem 0 1rem;
}
.category-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
}
.muted {
  color: #777;
  font-size: 0.9rem; }
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
.tags { display: flex; flex-direction: column; gap: 0.5rem; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: #eef2; border-radius: 12px; padding: 2px 8px; }
.chip-x {
  background: transparent;
  color: #1a1a1a;
  border: none;
  cursor: pointer;
  margin-left: 6px;
}
</style>
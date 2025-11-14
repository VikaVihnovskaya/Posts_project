<template>
  <div class="home">
    <header class="topbar">
      <div class="searchbar">
        <span class="search-icon"></span>
        <input
            type="search"
            v-model="search"
            @input="onSearchInput"
            :placeholder="'Search by title, category, author'"
        />
        <button v-if="search" class="clear" @click="clearSearch" aria-label="Clear search">×</button>
      </div>
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
        <h3>Sort</h3>
        <label class="field">
          <span>By date</span>
          <select v-model="sort" @change="onSortChange">
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
          </select>
        </label>
        <h3>Filter by date</h3>
        <label class="field">
          <span>From</span>
          <input type="date" v-model="dateFrom" :max="dateTo || undefined" />
        </label>
        <label class="field">
          <span>To</span>
          <input type="date" v-model="dateTo" :min="dateFrom || undefined" />
        </label>
        <h3>Filter by categories</h3>
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
        <h3>Filter by tags</h3>
        <div class="tags">
          <div class="chips">
      <span v-for="t in selectedTags" :key="t" class="chip">#
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
          <label class="field">
            <span>Match mode</span>
             <select v-model="tagMatch">
               <option value="contains">Contains (OR)</option>
               <option value="any">Any (OR)</option>
               <option value="all">All (AND)</option>
               <option value="exact">Exact (OR)</option>
             </select>
          </label>
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
// Поле поиска
const search = ref('')
let searchTimer = null

// Фильтры дат (строки формата YYYY-MM-DD)
const dateFrom = ref('')
const dateTo = ref('')
const sort = ref('createdAt:desc')
// Категории
const allCategories = ref([])
const selectedCategoryIds = ref([])
// Тэги
const selectedTags = ref([]) // массив строк тегов
const tagInput = ref('')     // текст в инпуте для добавления
const tagMatch = ref('contains') // contains | exact | any | all

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
function onSearchInput() {
  // легкий debounce, чтобы не спамить URL/запросы при наборе
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    const q = (search.value || '').trim()
    updateQuery({ page: 0, q })
  }, 400)
}

function clearSearch() {
  search.value = ''
  updateQuery({ page: 0, q: '' })
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
  // match — один из contains|exact|any|all
  const rawMatch = typeof query.match === 'string' ? query.match.toLowerCase() : ''
  const allowed = new Set(['contains', 'exact', 'any', 'all'])
  const match = allowed.has(rawMatch) ? rawMatch : 'contains'
  // sort: поддерживаем newest/oldest и createdAt:desc/asc
  let normSort = 'createdAt:desc'
  // Поддержка и старого, и нового формата
  let rawSort = typeof query.sort === 'string' ? query.sort.trim() : ''
  if (rawSort === 'newest') rawSort = 'createdAt:desc'
  if (rawSort === 'oldest') rawSort = 'createdAt:asc'
  if (rawSort === 'createdAt:asc' || rawSort === 'createdAt:desc') {
    normSort = rawSort
  } else if (typeof query.sortBy === 'string') {
    const by = query.sortBy
    const order = typeof query.order === 'string' ? query.order.toLowerCase() : 'desc'
    if (by === 'createdAt') {
      normSort = order === 'asc' ? 'createdAt:asc' : 'createdAt:desc'
    }
  }
  const q = typeof query.q === 'string' ? query.q : ''
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
    match,
    sort: normSort,
    q,
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
  if (tagMatch.value && tagMatch.value !== 'contains') {
    // Передаём match только если не дефолт, но можно и всегда
    query.match = tagMatch.value
  }
  if (sort.value?.startsWith('createdAt:')) {
    query.sortBy = 'createdAt'
    query.order = sort.value.endsWith(':asc') ? 'asc' : 'desc'
  }
  const q = (search.value || '').trim()
  if (q) query.q = q
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
      const { page: queryPage, limit: queryLimit, dateFrom: queryFrom, dateTo: queryTo, categories, tags, match, sort: querySort, q } = normalizeQuery(newQuery)
        page.value = queryPage
        limit.value = queryLimit
        dateFrom.value = queryFrom
        dateTo.value = queryTo
        selectedCategoryIds.value = categories
        selectedTags.value = tags
        tagMatch.value = match
        sort.value = querySort
        search.value = q || ''
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
  const match = partial.match ?? current.match ?? 'contains'
  if (match && match !== 'contains') next.match = match; else delete next.match
  const nextSort = partial.sort ?? current.sort ?? 'createdAt:desc'
  if (nextSort) next.sort = nextSort; else delete next.sort
  const q = typeof partial.q === 'string' ? partial.q : current.q
  if (q && q.trim()) next.q = q.trim(); else delete next.q
  // Убираем дубликаты
  const same =
      String(route.query.page ?? '') === String(next.page) &&
      String(route.query.limit ?? '') === String(next.limit) &&
      String(route.query.dateFrom ?? '') === String(next.dateFrom ?? '') &&
      String(route.query.dateTo ?? '') === String(next.dateTo ?? '') &&
      String(route.query.categories ?? '') === String(next.categories ?? '') &&
      String(route.query.tags ?? '') === String(next.tags ?? '') &&
      String(route.query.match ?? '') === String(next.match ?? '') &&
      String(route.query.sort ?? '') === String(next.sort ?? '') &&
      String(route.query.q ?? '') === String(next.q ?? '')
  if (same) return

  if (replace) await router.replace({ query: next })
  else await router.push({ query: next })
}
function applyFilters() {
  // При применении фильтра сбрасываем на первую страницу
  updateQuery({ page: 0, dateFrom: dateFrom.value, dateTo: dateTo.value, categories: selectedCategoryIds.value, tags: selectedTags.value, match: tagMatch.value, sort: sort.value, })
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
  // Возвращаем сортировку к дефолту
  sort.value = 'createdAt:desc'
  search.value = ''
  updateQuery({ page: 0, dateFrom: '', dateTo: '', categories: [], tags: [], match: 'contains' , sort: sort.value,  q: ''})
}
function onSortChange() {
  // При смене сортировки начинаем с первой страницы
  updateQuery({ page: 0, sort: sort.value })
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
  const needsDefaults = route.query.page === undefined || route.query.limit === undefined || route.query.sort === undefined
  if (needsDefaults) {
    await updateQuery({ page: query.page, limit: query.limit, dateFrom: query.dateFrom, dateTo: query.dateTo, categories: query.categories, sort: query.sort, }, { replace: true })
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
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 1rem;
  gap: .75rem;
}
.auth-actions {
  display: flex;
  gap: .5rem;
  align-items: center;
}
.searchbar {
  position: relative;
  flex: 1;
  max-width: 500px;
}
.searchbar .search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #777;
  pointer-events: none;
}
.search-icon {
  width: 18px;
  height: 18px;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>') no-repeat center;
  background: #777;
}
.searchbar input[type="search"] {
  width: 100%;
  padding: 8px 28px 8px 32px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #ffffff;
}
.searchbar .clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  color: #1a1a1a;
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
  margin: 1rem 0 0.5rem;
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
.tags {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  background: #eef2;
  border-radius: 12px;
  padding: 2px 8px;
}
.chip-x {
  background: transparent;
  color: #1a1a1a;
  border: none;
  cursor: pointer;
  margin-left: 6px;
}
.field { display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
}
</style>
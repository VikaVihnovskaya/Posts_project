<template xmlns="http://www.w3.org/1999/html">
  <div class="profile">
    <header class="topbar">
      <router-link class="btn outline" to="/">← Home</router-link>
      <router-link class="btn" to="/create">Create Post</router-link>
    </header>

    <div class="card">
      <h3>Personal Details</h3>
      <p class="subtitle">Update your personal information and profile photo.</p>
      <div class="grid">
        <div class="left">
          <div class="avatar-wrap">
            <img :src="avatarPreview || user?.avatarUrl || placeholder" alt="avatar" class="avatar" />
          </div>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFileChange">
          <button class="btn outline" type="button" @click="openFilePicker">Upload New Photo</button>
        </div>
        <form class="right" @submit.prevent="saveUserProfile">
          <label>Name
            <input v-model="form.name" type="text" placeholder="Your name" />
          </label>
          <label>Email
            <input v-model="form.email" type="email" placeholder="you@example.com" />
          </label>
          <label>About Me
            <textarea v-model="form.about" rows="5" placeholder="A short information about you..."></textarea>
          </label>
          <div class="actions">
            <button type="submit" class="btn" :disabled="saving">{{ saving ? 'Saving...' : 'Save Changes' }}</button>
          </div>
        </form>
      </div>
      <h3>My Posts</h3>
      <p class="subtitle">Your drafts and published posts</p>
      <div class="filters">
        <label>Status:
          <select v-model="myStatus">
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>
      <section v-if="myLoading" class="empty"><p>Loading…</p></section>
      <section v-else-if="myError" class="error" aria-live="polite">
        <p>{{ myError }}</p>
        <button class="btn outline" @click="loadMyPosts()">Try again</button>
      </section>
      <section v-else>
          <div v-if="myItems.length" class="feed">
            <PostCard v-for="p in myItems" :key="p._id" :post="p" />
          </div>
          <div v-else class="empty">
            <p>No posts yet</p>
          </div>
          <footer class="pager" v-if="myTotal > 0">
            <button class="btn outline" :disabled="myPage === 0 || myLoading" @click="myPrev">Back</button>
            <span>Page {{ myPage + 1 }} of {{ myTotalPages }}</span>
            <button class="btn outline" :disabled="myPage >= myTotalPages - 1 || myLoading" @click="myNext">Next</button>
          </footer>
      </section>

    </div>
  </div>
</template>

<script setup>
import {extractServerMessage, mapFetchError} from "../utils/handlerErrors.js";
import {computed, onMounted, reactive, ref, watch, watchEffect} from 'vue'
import {useAuthStore} from '../stores/auth'
import {useRoute, useRouter} from 'vue-router'
import PostCard from './PostCard.vue'

const auth = useAuthStore()
const user = computed(() => auth.user)
const form = reactive({ name: '', email: '', about: '' })
watchEffect(() => {
  form.name = user.value?.name || ''
  form.email = user.value?.email || ''
  form.about = user.value?.about || ''
})
const route = useRoute()
const router = useRouter()
const saving = ref(false)
const fileInput = ref(null)
const avatarFile = ref(null)
const avatarPreview = ref('')
const placeholder = 'https://ui-avatars.com/api/?name=User&size=160'
const myItems = ref([])
const myLoading = ref(false)
const myError = ref('')
const myPage = ref(0)
const myLimit = ref(10)
const myTotal = ref(0)
const myTotalPages = computed(() => Math.max(1, Math.ceil(myTotal.value / myLimit.value)))
const myStatus = ref('all') // 'all' | 'published' | 'draft'

function openFilePicker() {
       fileInput.value?.click()
}
function onFileChange(event) {
  const selectedFile = event.target.files?.[0]
  if (!selectedFile) return
  avatarFile.value = selectedFile
  avatarPreview.value = URL.createObjectURL(selectedFile)
}

async function uploadAvatarFile() {
  if (!avatarFile.value) return { ok: true }

  const formData = new FormData()
  formData.append('avatar', avatarFile.value)

  const response = await fetch('/api/users/avatar', {
    method: 'POST',
    credentials: 'include',
    body: formData
  })
  if (!response.ok) {
    const serverMsg = await extractServerMessage(response)
    return { ok: false, message: mapFetchError({ res: response, serverMessage: serverMsg }) }
  }
  const responseData = await response.json().catch(() => ({}))
  auth.user = { ...(auth.user || {}), avatarUrl: responseData?.avatarUrl || '' }
  avatarFile.value = null
  avatarPreview.value = ''
  return { ok: true }
}

async function saveUserProfile() {
  saving.value = true
  try {
    // 1) Загружаем аватар, если он выбран
    const avatarUploadResult = await uploadAvatarFile()
    if (!avatarUploadResult.ok) {
      return { ok: false, message: avatarUploadResult.message }
    }
    // 2) Сохраняем профиль
    const response = await fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        about: form.about
      })
    })
    if (!response.ok) {
      const serverMsg = await extractServerMessage(response)
      alert(mapFetchError({ res: response, serverMessage: serverMsg }))
      return { ok: false }
    }
    auth.user = await response.json().catch(() => ({}))
    alert('Profile saved')
  } catch (error) {
    alert(error.message)
  } finally {
    saving.value = false
  }
}
async function loadMyPosts({ allowAdjust = true } = {}) {
  myLoading.value = true
  myError.value = ''
  try {
    const params = new URLSearchParams({
      owner: 'me',
      limit: String(myLimit.value),
      page: String(myPage.value),
    })
    if (myStatus.value !== 'all') params.set('status', myStatus.value)
    const res = await fetch(`/api/posts?${params.toString()}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      const serverMsg = await extractServerMessage(res)
      myError.value = mapFetchError({ res, serverMessage: serverMsg })
      myItems.value = []
      myTotal.value = 0
      return
    }
    const data = await res.json()
    myItems.value = Array.isArray(data.items) ? data.items : []
    myTotal.value = data.total || 0
    // === Обработка выхода за пределы страниц ===
    if (allowAdjust && myPage.value > 0 && myItems.value.length === 0) {
      const totalPages = Math.max(1, Math.ceil(myTotal.value / myLimit.value))
      const lastPage = Math.max(0, totalPages - 1)
      if (myPage.value > lastPage) {
        myPage.value = lastPage
        await updateUrl({ replace: true }) // синхронизируем URL
        return await loadMyPosts({ allowAdjust: false })
      }
    }
  } catch (error) {
    myItems.value = []
    myTotal.value = 0
    myError.value = mapFetchError({ error })
  } finally {
    myLoading.value = false
  }
}
function normalizeStatus(queryStatus) {
  return queryStatus === 'published' || queryStatus === 'draft' ? queryStatus : 'all'
}

function normalizePage(queryPage) {
  const pageNumber = Number(queryPage)
  return Number.isInteger(pageNumber) && pageNumber >= 0 ? pageNumber : 0
}
onMounted(async () => {
  // Синхронизируемся с URL перед загрузкой
  const initialStatus = normalizeStatus(route.query.status)
  const initialPage = normalizePage(route.query.page)
  if (myStatus.value !== initialStatus) myStatus.value = initialStatus
  if (myPage.value !== initialPage) myPage.value = initialPage

  if (!auth.user) {
    await auth.checkAuth()
  }
  await loadMyPosts()
})
function updateUrl({ replace = true } = {}) {
  const nextQuery = {
    ...route.query,
    // Удаляем значения по умолчанию — Vue Router не будет добавлять их в query
    status: myStatus.value === 'all' ? undefined : myStatus.value,
    page: myPage.value > 0 ? String(myPage.value) : undefined,
  }

  const navigation = route.name
      ? { name: route.name, params: route.params, query: nextQuery }
      : { path: route.path, query: nextQuery }

  return replace ? router.replace(navigation) : router.push(navigation)
}

// При изменении фильтра статуса — сбрасываем страницу, обновляем URL и загружаем заново
watch(myStatus, async () => {
  myPage.value = 0
  await updateUrl({ replace: true })
  await loadMyPosts()
})

async function myNext() {
  if (myPage.value < myTotalPages.value - 1) {
    myPage.value += 1
    await updateUrl({ replace: false }) // записать в историю
    await loadMyPosts()
  }
}
async function myPrev() {
  if (myPage.value > 0) {
    myPage.value -= 1
    await updateUrl({ replace: false })
    await loadMyPosts()
  }
}
watch(
    () => ({ statusQuery: route.query.status, pageQuery: route.query.page }),
    ({ statusQuery, pageQuery }) => {
      const newStatus = normalizeStatus(statusQuery)
      const newPage = normalizePage(pageQuery)
      let changed = false
      if (myStatus.value !== newStatus) { myStatus.value = newStatus; changed = true }
      if (myPage.value !== newPage)   { myPage.value = newPage; changed = true }
      if (changed) {
        loadMyPosts()
      }
    }
)

</script>

<style scoped>
.profile {
  max-width: 1180px;
  margin: 1rem auto;
  padding: 0 1rem;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
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
.card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 30px;

}
.subtitle {
  color: #6b7280;
  margin-top: -6px;
}
.grid {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 28px;
  margin-top: 16px;
}
.left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.avatar-wrap {
  width: 160px;
  height: 160px;
  border-radius: 9999px;
  overflow: hidden;
  border: 2px solid #e5e7eb;
}
.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hidden {
  display: none;
}
.right label {
  display: block;
  font-weight: 600;
  margin-bottom: 10px;
  color: #1a1a1a;
  text-align: start;
}
.right input, .right textarea {
  width: 100%;
  color: #1a1a1a;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #d0d7e2;
  border-radius: 8px;
  margin-top: 6px;
  background: #e5e5e5;
}
.actions {
  display: flex;
  justify-content: end;
  margin-top: 16px;
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
.filters {
  margin: 0.5rem 0 1rem;
}
.filters select {
  margin-left: 0.5rem;
}
.error {
  background: #ffeaea;
  color: #a90000;
  border: 1px solid #ffb3b3;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  margin: 0.5rem 0 1rem;
}
@media (max-width: 860px){
  .grid {
    grid-template-columns: 1fr;
  } .actions { gap: 8px;
        flex-direction: column;
      }
}
</style>
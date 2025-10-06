<template>
  <div class="post-view" :class="{ editing: editPost }">
    <header class="topbar">
      <router-link class="btn outline" to="/">← Back</router-link>
      <div v-if="isOwner" class="owner-actions">
        <template v-if="!editPost">
          <button class="btn" @click="startEdit">Edit</button>
          <button class="btn outline danger" @click="onDelete" :disabled="busy">Delete</button>
        </template>
        <template v-else>
          <button class="btn" @click="onSave" :disabled="busy">Save</button>
          <button class="btn outline" @click="cancelEdit" :disabled="busy">Cancel</button>
        </template>
      </div>
    </header>

    <section v-if="loading" class="state">Loading…</section>
    <section v-else-if="error" class="state error">{{ error }}</section>
    <section v-else-if="!post" class="state">Post not found</section>

    <article v-else class="post">
      <p v-if="isOwner && post.status !== 'published'" class="banner warn">Draft/Archived — visible only to you</p>

      <template v-if="!editPost">
        <h1 class="title">{{ post.title }}</h1>
        <div class="meta">
          <span v-if="post.publishedAt">Published: {{ formatDate(post.publishedAt) }}</span>
          <span v-if="post.author"> • Author: {{ post.author }}</span>
        </div>
        <p v-if="post.summary" class="summary">{{ post.summary }}</p>

        <div class="details" v-if="post.details">
          <pre class="plain">{{ post.details }}</pre>
        </div>

        <div v-if="categoryNames.length" class="row">
          <strong>Categories:</strong>
          <ul class="inline-list">
            <li v-for="(name, i) in categoryNames" :key="i">{{ name }}</li>
          </ul>
        </div>
        <div v-if="post.tags?.length" class="row">
          <strong>Tags:</strong>
          <ul class="inline-list">
            <li v-for="(t, i) in post.tags" :key="i">#{{ t }}</li>
          </ul>
        </div>
        <section class="comments" v-if="isPublished">
          <h3>Comments</h3>
          <div v-if="commentsLoading" class="state">Loading comments…</div>
          <div v-else-if="commentsError" class="state error">{{ commentsError }}</div>

          <ul v-else-if="comments.length" class="comment">
            <li v-for="c in comments" :key="c._id" class="comment-item">
              <div class="comment-meta">
                <span class="date">{{ formatDate(c.createdAt) }}</span>
              </div>
              <div class="comment-body">{{ c.content }}</div>
            </li>
          </ul>
          <p v-else class="state">No comments yet</p>
          <div v-if="auth.user" class="comment-form">
            <label class="field">
              <span>Add a comment</span>
              <textarea v-model.trim="newComment" rows="3" maxlength="5000" placeholder="Write your comment…"></textarea>
            </label>
            <div class="actions">
              <button class="btn outline" type="button" @click="submitComment" :disabled="!newComment.trim()">Post comment</button>
            </div>
          </div>
          <div v-else class="state">Sign in to add a comment</div>
        </section>
      </template>

      <!-- Редактирование -->
      <template v-else>
        <h1 class="title">Edit post</h1>
        <form class="edit-form" @submit.prevent="onSave">
          <label class="field">
            <span>Title</span>
            <input v-model.trim="form.title" type="text" required minlength="3" maxlength="200" />
          </label>

          <label class="field">
            <span>Summary</span>
            <textarea v-model.trim="form.summary" maxlength="500" rows="3"></textarea>
          </label>

          <label class="field">
            <span>Details</span>
            <textarea v-model.trim="form.details" required minlength="10" rows="8"></textarea>
          </label>

          <label class="field">
            <span>Status</span>
            <select v-model="form.status">
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </label>

          <label class="field">
            <span>Tags (comma-separated)</span>
            <input v-model.trim="form.tagsText" type="text" placeholder="Enter new tags" />
          </label>
          <!-- Категории пока не редактируем, но отправим текущие названия, если есть -->
<!--          <div class="hint">Categories are preserved as is.</div>-->
          <div class="actions">
            <button class="btn" type="submit" :disabled="busy">Save</button>
            <button class="btn outline" type="button" @click="cancelEdit" :disabled="busy">Cancel</button>
          </div>
        </form>
      </template>
    </article>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {useAuthStore} from "../stores/auth.js"

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const id = route.params.id

const loading = ref(false)
const error = ref('')
const post = ref(null)

const editPost = ref(false)
const busy = ref(false)

const form = ref({
  title: '',
  summary: '',
  details: '',
  status: 'draft',
  tagsText: '',
})
const comments = ref([])
const commentsLoading = ref(false)
const commentsError = ref('')
const newComment = ref('')

const isPublished = computed(() => post.value?.status === 'published')
function formatDate(d) {
  const date = new Date(d)
  return date.toLocaleString()
}

const categoryNames = computed(() => {
  const arr = Array.isArray(post.value?.categories) ? post.value.categories : []
  return arr
      .map(c => (typeof c === 'object' && c !== null ? c.name : null))
      .filter(Boolean)
})

// Определяем владельца: проверяем несколько вариантов поля идентификатора
const currentUserId = computed(() => auth.user?.sub || auth.user?._id || auth.user?.id || null)
const isOwner = computed(() => {
  const pOwner = post.value?.userId
  if (!pOwner || !currentUserId.value) return false
  return String(pOwner) === String(currentUserId.value)
})

async function load() {
  loading.value = true
  error.value = ''
  post.value = null
    if (!auth.user) {
      await auth.checkAuth().catch(() => {})
    }
    const res = await fetch(`/api/posts/${id}`, {
      credentials: 'include',})
    const data = await res.json().catch(() => null)

    if (!res.ok) {
      error.value =
          res.status === 404
              ? 'Post not found'
              : res.status === 403
                  ? 'Post is not public (draft or archived)'
                  : data?.message || 'Failed to load post'
      loading.value = false
      return
    }
    post.value = data
    if (post.value?.title) {
      document.title = `${post.value.title} — Post`
    }
    loading.value = false
}
function startEdit() {
  if (!post.value) return
  editPost.value = true
  form.value = {
    title: post.value.title || '',
    summary: post.value.summary || '',
    details: post.value.details || '',
    status: post.value.status || 'draft',
    tagsText: Array.isArray(post.value.tags) ? post.value.tags.join(', ') : '',
  }
}

function cancelEdit() {
  editPost.value = false
}

function parseTags(text) {
  if (!text) return []
  return text
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
}

async function onSave() {
  if (!isOwner.value) return
  busy.value = true
  error.value = ''

    const payload = {
      title: form.value.title,
      summary: form.value.summary,
      details: form.value.details,
      status: form.value.status,
      tags: parseTags(form.value.tagsText),
      // Сохраняем текущие категории (по именам), если они были пока так
      categories: categoryNames.value,
    }

    const res = await fetch(`/api/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'include',
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      error.value = data?.message || 'Failed to update post'
      busy.value = false
      return
    }
    post.value = data
    editPost.value = false
    busy.value = false
}

async function onDelete() {
  if (!isOwner.value) return
  if (!confirm('Delete this post? This action cannot be undone.')) return

  busy.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/posts/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => null)
      error.value = data?.message || 'Failed to delete post'
      busy.value = false
      return
    }
    router.push('/')
  } finally {
    busy.value = false
  }
}
// Комментарии
async function loadComments() {
  commentsLoading.value = true
  commentsError.value = ''
  try {
    const res = await fetch(`/api/posts/${id}/comments`, { credentials: 'include' })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      commentsError.value = data?.message || 'Failed to load comments'
      comments.value = []
    } else {
      comments.value = Array.isArray(data?.items) ? data.items : []
    }
  } catch (e) {
    commentsError.value = 'Failed to load comments'
    comments.value = []
  } finally {
    commentsLoading.value = false
  }
}

async function submitComment() {
  if (!auth.user || !isPublished.value) return
  const body = (newComment.value || '').trim()
  if (!body) return
  const res = await fetch(`/api/posts/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content: body }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    alert(data?.message || 'Failed to add comment')
    return
  }
  comments.value.push(data)
  newComment.value = ''
}

onMounted(async () => {
  await load()
  await loadComments()
})

</script>

<style scoped>
.post-view {
  max-width: 1280px;
  margin: 1rem auto;
  padding: 2rem 1rem;
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.post-view.editing {
  max-width: 1280px;
  margin: 1rem auto;
  padding: 2rem 1rem;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.btn {
  padding: 6px 12px;
  background: #42b883;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
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
.btn.outline.danger {
  color: #b00020;
  border-color: #b00020;
}
.btn.outline.danger:hover {
  background: #b00020;
  color: #fff;
}
.owner-actions {
  display: flex;
  gap: .5rem;
}
.state {
  color: #666;
}
.state.error {
  color: #b00020;
}
.post .title {
  margin: 0 0 .25rem;
}
.meta {
  color: #777;
  margin-bottom: .75rem;
}
.summary {
  font-style: italic;
  white-space: pre-wrap;
}
.details {
  margin-top: 1rem;
  color: #1a1a1a
}
pre.plain {
  white-space: pre-wrap;
  font-family: inherit;
  background: #fff;
  border: 1px solid #eee;
  padding: .75rem;
  border-radius: 6px;
}
.row {
  margin-top: .75rem;
}
.inline-list {
  list-style: none;
  margin: 0; padding: 0;
  display: inline-flex;
  gap: .5rem;
  flex-wrap: wrap;
}
.banner.warn {
  background: #fff3cd;
  color: #8a6d3b;
  border: 1px solid #ffeeba;
  padding: .5rem .75rem;
  border-radius: 6px;
  margin-bottom: .75rem;
}
.edit-form {
  margin: 0;
  width: 100%;
  max-width: none;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  box-sizing: border-box;
}
.field {
  display: flex;
  flex-direction: column;
  gap: .5rem;
}

.field > span {
  font-weight: 800;
}
.field input, .field textarea, .field select {
  box-sizing: border-box;
  width: 100%;
  padding: .75rem;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  font-size: 1rem;
}
textarea { resize: vertical; }
.actions {
  display: flex;
  gap: .5rem;
}
.comments {
  margin-top: 2rem;
}
.comments h3 {
  margin-top: 0;
}
.comments .state {
  margin-bottom: 1rem;
}
.comment {
  list-style: none;
  margin: .5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: .75rem;
}
.comment-item {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: .75rem;
  background: #fff;
}
.comment-meta {
  font-size: .875rem;
  color: #777;
  margin-bottom: .25rem;
}
.comment-body {
  white-space: pre-wrap;
  color: #1a1a1a;
}
.comment-form {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: .5rem;
}
</style>
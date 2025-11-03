<template>
  <div class="create-post">
    <header class="topbar">
      <router-link class="btn outline" to="/">← Home</router-link>
    </header>
    <h2>Create a new post</h2>

    <form class="form" @submit.prevent="onSubmit">
      <div class="field">
        <label>Title *</label>
        <input v-model.trim="form.title" type="text" placeholder="Enter title" required minlength="3" maxlength="200" />
      </div>

      <div class="field">
        <label>Summary</label>
        <textarea v-model.trim="form.summary" rows="3" maxlength="500" placeholder="Enter short description"></textarea>
      </div>

      <div class="field">
        <label>Content *</label>
        <textarea
            v-model="form.details"
            rows="10"
            placeholder="Write your post content here. Minimum 10 characters."
            required
        ></textarea>
      </div>

      <div class="two-cols">
        <div class="field">
          <label>Categories</label>
          <Multiselect
              v-model="selectedCategoryIds"
              :options="categoryOptions"
              :multiple="true"
              :close-on-select="false"
              :clear-on-select="false"
              :preserve-search="true"
              track-by="_id"
              label="name"
              :reduce="categoryId"
              placeholder="Select categories"
          />
          <small class="hint">Select one or more categories</small>
        </div>
        <div class="field">
          <label>Tags * (at least one)</label>
          <input v-model="tagsInput" type="text" placeholder="Enter tags" required />
          <small class="hint">Enter tags, separated by commas.2–30 characters, only letters/numbers </small>
        </div>
      </div>

      <div class="field">
        <label>Author</label>
        <input v-model.trim="form.author" type="text" placeholder="Your display name" />
      </div>
      <div class="field inline">
        <label>Status:</label>

        <label class="radio">
          <input type="radio" value="draft" v-model="form.status" />
          <span>Draft</span>
        </label>

        <label class="radio">
          <input type="radio" value="published" v-model="form.status" />
          <span>Publish</span>
        </label>
      </div>

      <div class="actions">
        <button class="btn" type="button" :disabled="submitting" @click="submitAs('draft')">Save draft</button>
        <button class="btn" type="submit" :disabled="submitting">Publish</button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">Post created successfully!</p>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../utils/apiFetch.js'
import 'vue-multiselect/dist/vue-multiselect.css'
import Multiselect from "vue-multiselect";

const router = useRouter()
const submitting = ref(false)
const error = ref('')
const success = ref(false)

const form = ref({
  title: '',
  summary: '',
  details: '',
  author: '',
  status: 'published',
})

const tagsInput = ref('')
const categoryOptions = ref([])
const selectedCategoryIds = ref([])
const categoryId = c => c._id
// Парсинг строк по запятым
function parseList(input) {
  return String(input || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
}
// Валидация тегов — соответствует бэкенду (2–30, буквы/цифры/ _ -)
const tagRe = /^[a-z0-9а-яё_\-]+$/i
function normalizeTags(list) {
  // Повторяем set-логику бэкенда (нижний регистр, уникальность, тримминг)
  const normalized = list
      .map(s => String(s).trim().toLowerCase())
      .filter(Boolean)
  return Array.from(new Set(normalized))
}
function validateTags(list) {
  if (!Array.isArray(list) || list.length === 0) return 'Specify at least one tag'
  for (const t of list) {
    if (t.length < 2 || t.length > 30 || !tagRe.test(t)) {
      return 'Each tag must be 2–30 chars and contain only letters, numbers, underscores, or dashes'
    }
  }
  return ''
}
onMounted(async () => {
  try {
    categoryOptions.value = await apiFetch('/api/categories')
  } catch (e) {
    console.error('Failed to load categories.', e)
  }
})
async function submitAs(status) {
  form.value.status = status
  await onSubmit()
}

async function onSubmit() {
  error.value = ''
  success.value = false
  submitting.value = true
  try {
    const tags = normalizeTags(parseList(tagsInput.value))
    const validationMessage = validateTags(tags)
    if (validationMessage) {
      error.value = validationMessage
      submitting.value = false
      return
    }
    const categories = (selectedCategoryIds.value || []).map(c =>
        typeof c === 'string' ? c : c && c._id ? String(c._id) : null
    ).filter(Boolean)

    const payload = {
      title: form.value.title,
      summary: form.value.summary,
      details: form.value.details,
      author: form.value.author,
      status: form.value.status,
      categories,
      tags,
    }

    await apiFetch('/api/posts', {
      method: 'POST',
      body: payload,
    })

    success.value = true
    router.push('/')
  } catch (e) {
    error.value = e.message || 'Failed to create post'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.create-post {
  max-width: 1200px;
  margin: 1rem auto;
  padding: 0 1rem; }
.topbar {
  display: flex;
  align-items: center;
  gap: .75rem;
  margin-top: 1rem;
  margin-bottom: 1rem; }
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
input,
select {
  box-sizing: border-box;
  width: 100%;
  color: #1a1a1a;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: .75rem;
  background: #fff;
  font-size: 1rem;
}
.field.inline {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.field > label {
  display: block;
  margin-bottom: .35rem;
  font-size: 1.125rem;
  font-weight: 700;
}
.field.inline .radio {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  margin: 0;
}

.field.inline input[type="radio"] {
  accent-color: #2a9d6f;
  margin: 0;
  vertical-align: middle;
}

.field.inline input[type="radio"]:checked + span {
  color: #2a9d6f;
  font-weight: 600;
}

.two-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
textarea {
  box-sizing: border-box;
  width: 100%;
  color: #1a1a1a;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: .75rem;
  background: #fff;
  resize: vertical;
}
.btn {
  padding: 6px 12px;
  background: #42b883;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.btn:hover {
  background: #2a9d6f;
}
.btn.outline {
  background: transparent;
  color: #2a9d6f;
  border: 1px solid #2a9d6f;
  text-decoration: none;
}
.btn.outline:hover {
  background: #2a9d6f;
  color: #fff;
}
.btn:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.actions {
  display: flex;
  gap: .75rem; }
.error {
  color: #b00020;
}
.success {
  color: #2a9d6f; }
@media (max-width: 760px) { .two-cols { grid-template-columns: 1fr; } }
</style>
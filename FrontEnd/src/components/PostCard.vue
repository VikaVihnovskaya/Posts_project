<template>
  <router-link class="post-card" :to="{ name: 'PostView', params: { id: post._id } }" v-if="post">
    <div class="thumb">
      <img v-if="thumbnail" :src="thumbnail" :alt="post.title || 'post image'" loading="lazy" />
      <div v-else class="placeholder" aria-hidden="true"></div>
    </div>

    <div class="content">
      <h3 class="title">{{ post.title }}</h3>
      <div class="meta">
        <span v-if="post.author" class="author">{{ post.author }}</span>
        <span v-if="post.author && post.publishedAt"> • </span>
        <span v-if="post.publishedAt" class="date">{{ formatDate(post.publishedAt) }}</span>
        <span v-else-if="isOwnDraft" class="draft">Draft — only you see it</span>
      </div>
      <p v-if="post.summary" class="summary">{{ post.summary }}</p>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps({
  post: { type: Object, required: true },
})

const auth = useAuthStore()
const currentUserId = computed(() => auth.user?.sub || auth.user?._id || auth.user?.id || null)
const isOwnDraft = computed(() => {
  const pOwner = props.post?.userId
  const isDraft = props.post?.status !== 'published' && !props.post?.publishedAt
  if (!pOwner || !currentUserId.value) return false
  return String(pOwner) === String(currentUserId.value) && isDraft
})

const formatDate = (d) => {
  const date = new Date(d)
  return date.toLocaleDateString('EN', { day: '2-digit', month: 'long', year: 'numeric' })
}
// Первый URL из imageUrls — как миниатюра
const thumbnail = computed(() => {
  const list = Array.isArray(props.post?.imageUrls) ? props.post.imageUrls : []
  return list.length ? list[0] : ''
})
</script>

<style scoped>
.post-card {
  display: block;
  width: 100%;
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  box-shadow: 0 2px 8px rgba(0,0,0,.05);
  transition: transform .12s ease, box-shadow .12s ease;
}
.post-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.08) }

.thumb { width: 100%;
  aspect-ratio: 16/9;
  background: #f5f5f7
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block
}
.placeholder { width: 100%;
  height: 100%;
  background: repeating-linear-gradient(45deg,#f2f2f2,#f2f2f2 10px,#eaeaea 10px,#eaeaea 20px)
}
.content {
  padding: 12px 14px 14px;
}
.title {
  margin: 0 0 6px;
  font-size: 1.05rem;
  line-height: 1.25;
  font-weight: 800;
  color: #1a1a1a
}
.meta {
  color: #6b7280;
  font-size: .875rem;
  margin-bottom: 8px
}
.meta .draft {
  color: #8a6d3b
}
.summary {
  color: #1f2937;
  margin: 0 0 10px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
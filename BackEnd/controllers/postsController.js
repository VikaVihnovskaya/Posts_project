import { parsePaging } from '../utils/paging.js'
import { reconcilePublishFields } from '../utils/publishCheck.js'
import { listPosts, getPostById, createPost, updatePostEntity, deletePostById } from '../services/postsService.js'

export async function getPosts(req, res) {
    const { limit, page } = parsePaging(req)
    const requestedOwner = req.query.owner
    // если owner=me — показываем только посты текущего пользователя
    if (requestedOwner === 'me') {
        if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
        const { items, total } = await listPosts({ userId: req.user.sub, limit, page, ownerOnly: true })
        return res.json({ items, page, limit, total })
    }

    const userId = req.user?.sub || null
    const { items, total } = await listPosts({ userId, limit, page })
    res.json({ items, page, limit, total })
}

export async function getPost(req, res) {
    const { id } = req.params
    const post = await getPostById(id)
    if (!post) return res.status(404).json({ message: 'Post not found' })
    if (post.status !== 'published') {
        if (!req.user || String(post.userId) !== String(req.user.sub)) {
            return res.status(403).json({ message: 'Post is not public' })
        }
    }
    res.json(post)
}

export async function createPostCtrl(req, res) {
    const post = await createPost({ data: req.body, userId: req.user.sub })
    reconcilePublishFields(post)
    await post.save()
    res.status(201).json(post)
}

export async function updatePostCtrl(req, res) {
    const post = await updatePostEntity(req.post, req.body)
    reconcilePublishFields(post)
    await post.save()
    res.json(post)
}

export async function deletePostCtrl(req, res) {
    const s3 = req.app.locals.s3
    const bucket = req.app.locals.s3Bucket
    const post = req.post

    // Удаление файлов из бакета (best-effort)
    if (s3 && bucket && (post.imageUrls?.length)) {
        const { keyFromPublicUrl, deleteObjects } = await import('../utils/s3.js')
        const keys = post.imageUrls.map(u => keyFromPublicUrl(u, bucket)).filter(Boolean)
        if (keys.length) {
            try { await deleteObjects({ client: s3, bucket, keys }) } catch (e) { console.warn('MinIO cleanup failed', String(post._id), e) }
        }
    }
    await deletePostById(post._id)
    res.status(204).send()
}
export function reconcilePublishFields(doc) {
    if (doc.status === 'published') {
        if (!doc.publishedAt) doc.publishedAt = new Date()
    } else {
        doc.publishedAt = null
    }
}
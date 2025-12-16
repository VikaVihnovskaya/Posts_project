export function parsePaging(req) {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100)
    const page = Math.max(parseInt(req.query.page || '1', 10), 1)
    // Внутренний индекс для skip()
    const pageIndex = page - 1
    return { limit, page, pageIndex }
}
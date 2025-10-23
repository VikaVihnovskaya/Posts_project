export function parsePaging(req) {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100)
    const page = Math.max(parseInt(req.query.page || '0', 10), 0)
    return { limit, page }
}
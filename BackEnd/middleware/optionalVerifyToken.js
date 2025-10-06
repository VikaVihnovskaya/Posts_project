import jwt from 'jsonwebtoken'
export function optionalVerifyToken(req, _res, next) {
    const token = req.cookies?.token
    if (!token) return next()
    try { req.user = jwt.verify(token, process.env.JWT_SECRET) } catch (_) {}
    next()
}
import express from 'express'
import multer from 'multer'
import { optionalVerifyToken } from '../middleware/optionalVerifyToken.js'
import { verifyToken } from '../middleware/verifyToken.js'
import { validateObjectId } from '../middleware/validateObjectId.js'
import { validatePublishedPost } from '../middleware/validatePublishedPost.js'
import { checkPostOwner } from '../middleware/checkPostOwner.js'
import { validateCommentContent } from '../middleware/validateCommentContent.js'
import { errorHandler } from '../middleware/errorHandler.js'
import { getPosts, getPost, createPostCtrl, updatePostCtrl, deletePostCtrl } from '../controllers/postsController.js'
import { uploadImagesCtrl, deleteImagesCtrl } from '../controllers/imagesController.js'
import { getCommentsCtrl, createCommentCtrl, updateCommentCtrl, deleteCommentCtrl } from '../controllers/commentsController.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 10 }, fileFilter: (req, file, cb) => (/^image\//.test(file.mimetype) ? cb(null, true) : cb(new Error('Only image files are allowed'))) })

// Posts
router.get('/', optionalVerifyToken, (req, res, next) => getPosts(req, res).catch(next))
router.get('/:id', optionalVerifyToken, validateObjectId('id'), (req, res, next) => getPost(req, res).catch(next))
router.post('/', verifyToken, (req, res, next) => createPostCtrl(req, res).catch(next))
router.put('/:id', verifyToken, validateObjectId('id'), checkPostOwner, (req, res, next) => updatePostCtrl(req, res).catch(next))
router.delete('/:id', verifyToken, validateObjectId('id'), checkPostOwner, (req, res, next) => deletePostCtrl(req, res).catch(next))

// Images
router.post('/:id/images', verifyToken, validateObjectId('id'), checkPostOwner, upload.array('images', 10), (req, res, next) => uploadImagesCtrl(req, res).catch(next))
router.delete('/:id/images', verifyToken, validateObjectId('id'), checkPostOwner, (req, res, next) => deleteImagesCtrl(req, res).catch(next))

// Comments
router.get('/:id/comments', validatePublishedPost('id'), (req, res, next) => getCommentsCtrl(req, res).catch(next))
router.post('/:id/comments', verifyToken, validatePublishedPost('id'), validateCommentContent, (req, res, next) => createCommentCtrl(req, res).catch(next))
router.put('/:postId/comments/:commentId', verifyToken, validatePublishedPost('postId'), validateObjectId('commentId'), validateCommentContent, (req, res, next) => updateCommentCtrl(req, res).catch(next))
router.delete('/:postId/comments/:commentId', verifyToken, validatePublishedPost('postId'), validateObjectId('commentId'), (req, res, next) => deleteCommentCtrl(req, res).catch(next))

router.use(errorHandler)
export default router
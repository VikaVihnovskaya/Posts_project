# BackEnd — Architecture and Key Files

This document explains how the Node.js backend is organized, how requests flow through the layers, and what each folder and important file is responsible for.

- Platform: Node.js 18+, Express
- Database: MongoDB (via Mongoose)
- Object storage: MinIO (S3 compatible) for images/avatars
- Auth: JWT in httpOnly cookie


## High‑level flow

**Terminology:**  
The *high‑level flow* describes how a request moves through the backend layers — from routes and middleware to controllers, services, and models — before returning a response.

1) Client sends HTTP request to Express route (e.g., GET /api/posts).
2) Route attaches middlewares (auth, validation, uploads), then calls a controller.
3) Controller orchestrates: parses input, calls a service for business logic, and returns a response.
4) Services talk to Mongoose models (MongoDB) and to external utilities (S3 for images), then return data to controllers.
5) Errors are passed to a centralized error handler middleware.


## Entry point

**Terminology:**  
The *entry point* is the file that boots the backend application, initializes core services, and mounts routes.

- **File:** `BackEnd/index.js`
  - Boots Express app and core middlewares (CORS, JSON parsing, cookie parser).
  - Mounts routers:
    - `/api/users `→ `routes/userRoutes.js`
    - `/api/posts` → `routes/postRoutes.js`
    - `/api/categories` → `routes/categoryRoutes.js`
  - Initializes S3 client and ensures the bucket exists and is public for object reads.
  - Exposes health endpoints:
    - `GET /health/live `→ quick liveness probe
    - `GET /health/ready `→ checks Mongo connectivity and S3 availability
  - Reads configuration from environment variables (see below).


## Folders overview

**Terminology:**  
The *folders overview* explains the purpose of each backend directory.

- **routes/** — Express route definitions, compose middlewares and controller calls.
- **controllers/** — Request handlers: validate inputs at a high level, call services, shape HTTP responses.
- **services/** — Business logic and integration with data stores (Mongo, S3). Contains reusable operations.
- **models/** — Mongoose schemas and models for MongoDB collections (User, Post, Comment, Category).
- **middleware/** — Reusable Express middlewares: auth (JWT), validation, error handling, uploads.
- **utils/** — Helper modules for cross‑cutting concerns (S3 client, pagination helpers, publish checks).


## Key files by folder

### routes/
- userRoutes.js
  - Auth and profile: register, login (sets JWT cookie), logout, get/update profile.
  - Avatar upload to S3/MinIO.
  - User category preferences CRUD.
  - Uses verifyToken where authentication is required and errorHandler at the end.
- postRoutes.js
  - CRUD for posts; image upload/delete; comments CRUD.
  - Mix of optionalVerifyToken (to personalize public reads) and verifyToken (for protected actions).
  - Validation middlewares: validateObjectId, validatePublishedPost, validateCategoriesBody, validateCommentContent.
  - Uses upload middleware for multipart images.
- categoryRoutes.js
  - Read operations related to categories (list/fetch). Mounted at /api/categories.

### controllers/
- postsController.js
  - getPosts, getPost: read with filters, pagination, personalization by user preferences.
  - createPostCtrl, updatePostCtrl, deletePostCtrl: own‑post management.
- imagesController.js
  - uploadImagesCtrl, deleteImagesCtrl: post images stored in S3; uses utils/s3.js.
- commentsController.js
  - getCommentsCtrl, createCommentCtrl, updateCommentCtrl, deleteCommentCtrl.

### services/
- postsService.js
  - Core post query builder (filters: text, date range, categories, tags, sort) and mutations.
  - Image keys management for S3; coordinates with models.Post.
- imagesService.js
  - Low‑level helpers to upload/delete images via S3 and update post records accordingly.
- commentsService.js
  - CRUD for comments with ownership checks.

### models/
- User.js — account auth (login, password hash), profile fields (name, email, about, avatarUrl), preferredCategoryIds.
- Post.js — post content, status (draft/published), categories, tags, images, owner.
- Comment.js — comment text, author, post relation, timestamps.
- Category.js — categories taxonomy.

### middleware/
- verifyToken.js — verifies JWT from httpOnly cookie and places user in req.user.
- optionalVerifyToken.js — same as verifyToken but non‑blocking; enriches req.user if valid.
- uploadMiddleware.js — configures multer for parsing multipart/form‑data (images/avatar).
- validateObjectId.js — checks route parameters for valid Mongo ObjectId.
- validatePublishedPost.js — ensures a post is published for public actions (e.g., viewing, comments read).
- validateCommentContent.js — minimal validation for comment content.
- validateCategories.js — validates categories array in post create/update body.
- checkPostOwner.js — ensures current user owns the target post for modifications.
- errorHandler.js — centralized error formatting for thrown/rejected errors.

### utils/
- s3.js
  - createS3Client() — builds AWS SDK S3 client for MinIO (forcePathStyle true).
  - ensureBucket() / makeBucketPublicRead() — bootstrap and public‑read policy.
  - uploadBufferToS3(), deleteObjects() — object operations.
  - buildPublicUrl(), keyFromPublicUrl() — map keys to public URLs and back.
- paging.js — small helper for pagination calculations.
- publishCheck.js — helpers regarding publish status.


## Environment variables (BackEnd)

**Terminology:**  
*Environment variables* configure the backend at runtime — database, storage, authentication, and ports.

| Variable       | Purpose                          | Example                     |
|----------------|----------------------------------|-----------------------------|
| PORT           | Express port                     | 3000                        |
| MONGO_URL      | MongoDB connection string        | mongodb://mongo:27017/mydb  |
| JWT_SECRET     | Secret for JWT signing           | mysecret                    |
| S3_ENDPOINT    | MinIO/S3 endpoint URL            | http://minio:9002           |
| S3_ACCESS_KEY  | Access key for MinIO/S3          | minio                       |
| S3_SECRET_KEY  | Secret key for MinIO/S3          | miniopass                   |
| S3_BUCKET      | Bucket name for images           | posts                       |
| S3_PUBLIC_URL  | Public URL for serving images    | http://localhost:9002       |


## Health checks
- GET /health/live — process liveness.
- GET /health/ready — readiness: verifies MongoDB connection and S3 bucket accessibility.


## Typical request paths
- Public read: GET /api/posts (optionalVerifyToken) → postsController.getPosts → postsService.getPosts → models.Post.find → response.
- Create post: POST /api/posts (verifyToken + validateCategoriesBody) → postsController.createPostCtrl → postsService.create → models.Post.create.
- Upload images: POST /api/posts/:id/images (verifyToken + checkPostOwner + upload) → imagesController.uploadImagesCtrl → imagesService.upload → utils/s3.
- Comments: POST /api/posts/:id/comments (verifyToken + validatePublishedPost + validateCommentContent) → commentsController.createCommentCtrl → commentsService.create.
- Profile: PUT /api/users (verifyToken) → update profile fields; POST /api/users/avatar (verifyToken + upload) → S3 upload and URL save.


## Notes
- All protected operations rely on a JWT in an httpOnly cookie named "token".
- Bucket policy is set to allow public read of objects; URLs are generated using S3_PUBLIC_URL when provided.
- Error handling is centralized via middleware/errorHandler.js added at the end of routers.


---

## Beginner-friendly overview
If you are new to this project, think of the backend as a pipeline:
- Express receives the HTTP request.
- Middlewares check permissions, validate inputs, and parse uploads.
- Controllers call Services, which talk to MongoDB (via Mongoose) and MinIO/S3 for files.
- A single error handler shapes all errors to JSON responses.

This separation keeps HTTP concerns (routes/controllers) away from data/business concerns (services/models).


## Authentication flow (JWT in httpOnly cookie)
- Login: POST /api/users/login with JSON { login, password }.
- Backend verifies credentials, creates a JWT, and sets it as cookie token (httpOnly, sameSite=Strict).
- For protected endpoints, middleware verifyToken reads and validates this cookie.
- Logout removes the token cookie.

Example:
- Login
  curl -i -X POST http://localhost:3000/api/users/login \
    -H "Content-Type: application/json" \
    -d '{"login":"demo","password":"demo"}'
  # On success, response includes: Set-Cookie: token=...; HttpOnly; ...
- Authenticated profile
  curl -i http://localhost:3000/api/users \
    --cookie "token=PASTE_THE_TOKEN_COOKIE_VALUE"
- Logout
  curl -i -X POST http://localhost:3000/api/users/logout --cookie "token=..."


## API endpoints catalog (short)

**Terminology:**  
*API endpoints* define the available routes for interacting with users, posts, comments, categories, and health checks.

Users
- POST /api/users/create — register user
- POST /api/users/login — sign in (sets cookie)
- POST /api/users/logout — sign out (clears cookie)
- GET  /api/users — get current profile (requires auth)
- PUT  /api/users — update profile (requires auth)
- POST /api/users/avatar — upload avatar (multipart, field: avatar, requires auth)
- GET  /api/users/check — same as profile (requires auth)
- GET  /api/users/preferences — list preferred category ids (requires auth)
- PUT  /api/users/preferences — save preferred category ids (requires auth; body: { categoryIds: string[] })
- DELETE /api/users/preferences — clear preferences (requires auth)

Posts and images
- GET  /api/posts — list posts (public, optional auth affects ordering)
- GET  /api/posts/:id — single post (public)
- POST /api/posts — create post (auth; body validated)
- PUT  /api/posts/:id — update own post (auth; owner only)
- DELETE /api/posts/:id — delete own post (auth; owner only)
- POST /api/posts/:id/images — upload images (auth; owner; multipart field: images, up to 10 files)
- DELETE /api/posts/:id/images — delete all/selected images (auth; owner)

Comments
- GET    /api/posts/:id/comments — list comments for a published post (public)
- POST   /api/posts/:id/comments — create comment (auth)
- PUT    /api/posts/:postId/comments/:commentId — update own comment (auth)
- DELETE /api/posts/:postId/comments/:commentId — delete own comment (auth)

Categories
- GET /api/categories — list categories (public)

Health
- GET /health/live — liveness
- GET /health/ready — readiness (Mongo + S3)


## Listing posts — query parameters
GET /api/posts supports these optional query params:
- q — text search (title/body)
- from — ISO date (inclusive) filter by creation date from
- to — ISO date (inclusive) filter by creation date to
- categories — comma‑separated category ids
- tags — comma‑separated tags
- match — tags match mode: any | all | contains | exact (depends on service logic)
- sort — createdAt:desc (default) or createdAt:asc
- page — 1‑based page number
- limit — items per page (e.g., 10, 20)

Response shape typically includes:
{
  "items": [ /* posts */ ],
  "page": 1,
  "limit": 10,
  "total": 42
}

If a user is authenticated and has preferred categories, results prioritize those categories first.


## Error responses

**Terminology:**  
*Error responses* are standardized JSON outputs with HTTP status codes.

All errors are returned as JSON with an appropriate HTTP status. Common statuses:
- 400 Bad Request — validation errors
- 401 Unauthorized — missing/invalid token or wrong credentials
- 403 Forbidden — not the owner, or action not allowed
- 404 Not Found — entity not found
- 409 Conflict — duplicate user login, etc.
- 500 Internal Server Error — unexpected

Example error body:
{
  "message": "Invalid email format",
  "code": "VALIDATION_ERROR"
}


## File uploads
- Avatar: POST /api/users/avatar with multipart/form‑data field avatar.
- Post images: POST /api/posts/:id/images with field images (multiple allowed, e.g., up to 10).
- Stored in S3/MinIO under bucket S3_BUCKET. Public URLs are generated via S3_PUBLIC_URL if set, or S3_ENDPOINT.

Tips:
- Max file size and allowed types are controlled in middleware/uploadMiddleware.js (adjust as needed).
- S3 client uses forcePathStyle to be compatible with MinIO.


## Health checks (detailed)
- /health/live returns { status: "ok" } if the process is up.
- /health/ready runs a quick Mongo and S3 check, returning:
{
  "mongo": true,
  "s3": true
}
HTTP status 200 when both are true; 503 otherwise.


## Troubleshooting

**Terminology:**
*Troubleshooting* lists common issues and fixes for MongoDB, MinIO, authentication, and validation.
- MongoDB connection fails on Docker
  - Ensure docker‑compose is up and MONGO_URL points to mongodb://mongo:27017/<db>.
  - Check container logs for the backend and Mongo.
- MinIO/S3 issues (can’t upload or list images)
  - Verify S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET.
  - First run creates bucket and sets public read policy. If policy errors, ensure your MinIO allows PutBucketPolicy.
  - For local development, S3_PUBLIC_URL should be http://localhost:9002 so public URLs resolve from browser.
- Auth cookie not present in browser
  - Check that frontend requests include credentials (fetch with credentials: 'include').
  - Ensure CORS configuration in BackEnd/index.js has credentials: true and correct origin.
  - SameSite=Strict blocks cross‑site cookie on some flows; adjust if needed for your environment.
- Invalid ObjectId errors
  - Validate id parameters on the client before calling the API; backend uses validateObjectId middleware.
- 401 after some time
  - Token expires in 5h by default; re‑authenticate or adjust expiry in userRoutes.js.

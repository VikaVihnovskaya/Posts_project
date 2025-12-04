# ViPost — posts platform (Vue 3 + Node.js + MongoDB)

This repository contains a full‑featured blogging app: feed browsing, filtering and sorting, comments, user profile, avatar and post image uploads. Frontend is built with Vue 3 (Vite), backend — Node.js + Express, database — MongoDB. MinIO (S3‑compatible storage) is used for images. A ready‑to‑use docker‑compose is included.


## Application structure
The application contain:
1. Home (posts feed)
  - Text search
  - Filters: by date (from/to), by categories, by tags (match modes: contains/any/all/exact)
  - Sort by date (newest/oldest)
  - Pagination
  - Personalized ordering by preferred categories (for authenticated users)
2. Post page (single post view)
  - Full post content, images, categories, tags
  - Comments list and form (create/edit/delete own comments when allowed)
3. Profile (requires auth)
  - Edit profile: name, email, about, avatar
  - Manage preferred categories (affect Home ordering)
  - "My posts" list with status filter and pagination
4. Create post (requires auth)
  - Create: title, body, categories, tags, images
  - Save as Draft or Publish
5. Auth pages
  - Login
  - Register

## Routing (all routes)
- Path: / — name: Home — component: Home.vue
- Path: /posts/:id — name: PostView — component: PostView.vue
- Path: /profile — name: Profile — component: Profile.vue — meta: { requiresAuth: true }
- Path: /create — name: CreatePost — component: CreatePost.vue — meta: { requiresAuth: true }
- Path: /login — name: LoginUser — component: LoginUser.vue
- Path: /register — name: RegisterUser — component: RegisterUser.vue

Navigation guards and redirects:
- Protected routes: /profile and /create require authentication. Unauthenticated users are redirected to /login with ?redirect=<target>.
- If already authenticated and navigating to /login or /register, user is redirected to the value of ?redirect or to /profile.


## Main features
- User auth (sign up, sign in, sign out, session restore)
- User profile: edit data and upload avatar
- Posts: create, read, update, delete (CRUD) — with images (S3/MinIO)
- Post comments: create/edit/delete
- Post categories and tags
- Feed: search, sort, filters (date/categories/tags), pagination
- User preferred categories that affect the feed


## Project requirements
These functional requirements summarize how the app should work.

1. Authentication and account management
- User registration with email, password.
- Sign in / sign out.
- Authorization is required to create/edit posts and to comment.
- User profile page with editing of personal data and avatar.

2. Blog post management (authorized users only)
- Create a new post with:
  - Title
  - Short description (summary)
  - Main content using a rich text editor
  - Categories
  - Option to save as Draft or Publish
- Edit and delete only own posts.
- See the list of your own posts with filtering by status (draft, published).
- Archive of published posts is available to everyone.

3. Browsing and navigation (available to everyone)
- Home page with the posts feed.
- Sorting and filtering by date, categories and tags.
- Search by title, categories and author.
- Post details page with full article.

4. Comments (authorized users only)
- Ability to leave a comment under a post.
- Edit and delete only your own comments.
- Comments are visible to all users.
- No complex moderation (no administrator moderation is assumed).

5. Feed personalization
- In the profile, an authenticated user selects preferred blog categories.
- On the Home page for an authenticated user, posts are ordered as:
  - First, publications from the preferred categories.
  - Then all the remaining posts.
- Preferences can be changed and reset at any time.

Roles and permissions
- Guest (not authenticated):
  - View posts: Yes
  - Create posts: No
  - Edit own posts: No
  - Comment: No
  - Manage comments: No
  - Moderation: No
- Authenticated user:
  - View posts: Yes
  - Create posts: Yes
  - Edit own posts: Yes
  - Comment: Yes
  - Manage comments: Only own comments
  - Moderation: No

Pages and key elements
- Home (feed): post previews, ordering by preferences, search, filters, buttons for sign in/register or profile and sign out for authorized users.
- Post page: title, full text, categories, tags, author, date, comments list and form (for authorized users).
- Create/Edit post: rich text editor, fields for title, categories, tags, buttons “Save as draft” and “Publish”.
- Profile: user info, avatar, selection of preferred categories, list of own posts with filtering.
- Auth pages: registration, login.


## System requirements
Minimum to run with Docker:
- Docker 24+
- Docker Compose v2

For local run without Docker (optional):
- Node.js 18+ and npm 9+
- MongoDB 7+
- MinIO (or any S3‑compatible store)


## Quick start (Docker)
1) Build images and start containers
- sudo docker compose up -d --build

2) Stop and remove containers (Mongo and MinIO data are persisted in volumes)
- sudo docker compose down

3) Full stop + prune data (removes volumes)
- docker compose down -v

After startup the services are available at:
- http://localhost:5173 — Frontend (Vue, hot reload)
- http://localhost:3000 — Backend API (Express, nodemon)
- http://localhost:27017 — MongoDB (CLI/driver)
- http://localhost:8081 — Mongo Express GUI (default login/password)
- http://localhost:9001 — MinIO Console (login: minio, password: miniopass)
- S3 API: http://localhost:9002


## Environment variables (docker‑compose)
Backend receives the following variables:
- MONGO_URL=mongodb://mongo:27017/mydb
- S3_ENDPOINT=http://minio:9002
- S3_ACCESS_KEY=minio
- S3_SECRET_KEY=miniopass
- S3_BUCKET=posts
- S3_PUBLIC_URL=http://localhost:9002
- PORT=3000
- JWT_SECRET=… (defined in compose, change it in production)


## Local run without Docker (short)
- BackEnd:
  - cd BackEnd
  - npm i
  - Set environment variables similar to docker‑compose (MONGO_URL, S3_*, JWT_SECRET, PORT)
  - npm run dev (or npm start)
- FrontEnd:
  - cd FrontEnd
  - npm i
  - npm run dev (Vite on 5173)
- Start MongoDB and MinIO locally, or point the app to their URLs.


## Repository structure
- FrontEnd — Vue 3 (Vite) client
  - src/components — pages and components (Home.vue, PostView.vue, Profile.vue, CreatePost.vue, LoginUser.vue, RegisterUser.vue, PostCard.vue, …)
  - src/router/index.js — routing
  - src/stores — Pinia stores (auth, preferences)

- BackEnd — Node.js (Express) server
  - routes — API routes (posts, users, categories, comments, uploads)
  - controllers, services, middleware, models, utils — app layers
- docker — Dockerfiles for frontend and backend
- docker-compose.yml — infrastructure: frontend, backend, mongo, mongo-express, minio


## Available services (local, via Docker)
- http://localhost:5173 → Vue (hot reload)
- http://localhost:3000 → Node.js API (with nodemon)
- http://localhost:27017 → MongoDB (CLI/driver)
- http://localhost:8081 → Mongo Express GUI
- http://localhost:9001 → MinIO Console (login: minio / miniopass)
- http://localhost:9002 → MinIO S3 API




## Detailed backend documentation
For a deeper explanation of the backend architecture, endpoints, authentication flow, file uploads, pagination, health checks and troubleshooting, see:
- BackEnd/README.md

## Detailed frontend documentation
For a deeper explanation of the frontend architecture, key files, styles, API interaction and troubleshooting, see:
- FrontEnd/README.md

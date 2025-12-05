# ViPost — posts platform (Vue 3 + Node.js + MongoDB)

This repository contains a full‑featured blogging app: feed browsing, filtering and sorting, comments, user profile, avatar and post image uploads. Frontend is built with Vue 3 (Vite), backend — Node.js + Express, database — MongoDB. MinIO (S3‑compatible storage) is used for images. A ready‑to‑use docker‑compose is included.


## Application structure

**Terminology:**  
The *application structure* describes how the app is organized into its main functional parts (pages, features, and modules). It serves as a blueprint showing what components exist, what each one does, and how they fit together for users and developers.

The application contains:
- **Home (posts feed)**
    - Text search
    - Filters: by date (from/to), by categories, by tags (match modes: contains/any/all/exact)
    - Sort by date (newest/oldest)
    - Pagination
    - Personalized ordering by preferred categories (for authenticated users)

- **Post page (single post view)**
    - Full post content, images, categories, tags
    - Comments list and form (create/edit/delete own comments when allowed)

- **Profile (requires auth)**
    - Edit profile: name, email, about, avatar
    - Manage preferred categories (affect Home ordering)
    - "My posts" list with status filter and pagination

- **Create post (requires auth)**
    - Create: title, body, categories, tags, images
    - Save as Draft or Publish

- **Auth pages**
    - Login
    - Register

---

## Repository structure

**Terminology:**  
The *repository structure* explains how the project’s source code and files are organized. It shows where frontend, backend, and infrastructure components live, making it easier for developers to navigate and maintain the codebase.

- **FrontEnd — Vue 3 (Vite) client**
    - `src/components` — pages and components (`Home.vue`, `PostView.vue`, `Profile.vue`, `CreatePost.vue`, `LoginUser.vue`, `RegisterUser.vue`, `PostCard.vue`, …)
    - `src/router/index.js` — routing
    - `src/stores` — Pinia stores (auth, preferences)

- **BackEnd — Node.js (Express) server**
    - `routes` — API routes (posts, users, categories, comments, uploads)
    - `controllers`, `services`, `middleware`, `models`, `utils` — app layers

- **docker** — Dockerfiles for frontend and backend
- **docker-compose.yml** — infrastructure: frontend, backend, mongo, mongo-express, minio


## Architecture Overview

**Terminology:**  
*Architecture overview* describes the high‑level design of the system — how frontend, backend, database, and storage interact, and how infrastructure ties them together.

ViPost is structured into four main layers — **Frontend (Vue 3)**, **Backend (Express)**, **Database (MongoDB)**, and **Object Storage (MinIO)** — orchestrated together with **Docker Compose**.

### 1. Frontend (Vue 3 + Vite)
- **Framework:** Vue 3 with Composition API for building reactive UI.
- **Build tool:** Vite for fast development and hot reload.
- **State management:** Pinia stores (authentication, user preferences).
- **Routing:** Vue Router with navigation guards for protected routes.
- **Key components:**
    - `Home.vue` — posts feed with filters, search, and sorting.
    - `PostView.vue` — single post view with comments.
    - `Profile.vue` — profile editing and preferred categories.
    - `CreatePost.vue` — post creation and editing.
    - `LoginUser.vue` / `RegisterUser.vue` — authentication pages.
- **API interaction:** fetch for communication with backend REST API.
- **Media handling:** Image upload (avatars, post images) via S3/MinIO.

### 2. Backend (Node.js + Express)
- **Framework:** Express.js providing RESTful API endpoints.
- **Application layers:**
    - **Routes** — define API endpoints (`/posts`, `/users`, `/comments`, `/category`).
    - **Controllers** — handle request logic.
    - **Services** — interact with MongoDB and MinIO.
    - **Models** — Mongoose schemas for users, posts, comments.
    - **Middleware** — JWT authentication, validation, error handling.
    - **Utils** — helper functions (e.g., token generation).
- **Features:**
    - CRUD operations for posts and comments.
    - JWT-based authentication and authorization.
    - File uploads to MinIO.
    - Pagination and filtering.
    - Health-check endpoints.

### 3. Database (MongoDB)
- **Type:** Document-oriented database.
- **Collections:**
    - `users` — profile data, hashed passwords, preferences.
    - `posts` — title, content, categories, tags, status (draft/published).
    - `comments` — comment text, author, linked post.
    - `categories` / `tags` — metadata for filtering.
- **Indexes:** Optimized for search by title, categories, and tags.
- **Relations:** References via ObjectId (post ↔ comments, post ↔ author).

### 4. Object Storage (MinIO, S3-compatible)
- **Purpose:** Store images (avatars, post images).
- **Integration:** Backend uploads files via S3 API, URLs stored in MongoDB.
- **Access:**
    - Console: `http://localhost:9001`
    - Public S3 API: `http://localhost:9002`

### 5. Infrastructure (Docker Compose)
- **Services:**
    - `frontend` — Vue client.
    - `backend` — Express API.
    - `mongo` — MongoDB database.
    - `mongo-express` — MongoDB GUI.
    - `minio` — object storage.
- **Orchestration:** All services launched with `docker compose up`.
- **Persistence:** MongoDB and MinIO data stored in Docker volumes.
- **Networking:** Internal Docker network connects all containers.

### 6. Authentication & Authorization
- **Registration/Login:** Email + password.
- **Tokens:** JWT for secure authorization.
- **Route protection:** `/profile` and `/create` require authentication.
- **Roles:**
    - Guest — view-only access.
    - Authenticated user — create/edit posts, comment, manage own content.

### 7. Personalization
- **Mechanism:** Users select preferred categories in their profile.
- **Feed ordering:** Home feed prioritizes posts from preferred categories.
- **Storage:** Preferences saved in user profile (MongoDB).


## Routing (all routes)

**Terminology:**  
*Routing* defines the mapping between URL paths and application views/components. It controls navigation, access rules, and redirects within the app.

- Path: / — name: Home — component: Home.vue
- Path: /posts/:id — name: PostView — component: PostView.vue
- Path: /profile — name: Profile — component: Profile.vue — meta: { requiresAuth: true }
- Path: /create — name: CreatePost — component: CreatePost.vue — meta: { requiresAuth: true }
- Path: /login — name: LoginUser — component: LoginUser.vue
- Path: /register — name: RegisterUser — component: RegisterUser.vue

**Navigation guards and redirect:**
- Protected routes (`/profile`, `/create`) redirect unauthenticated users to `/login?redirect=<target>`.
- Authenticated users navigating to `/login` or `/register` are redirected to `?redirect` or `/profile`.



## Main Features

**Terminology:**  
*Main features* describe the core capabilities of the application — the essential functions that users can perform and interact with. This section highlights the practical value of the app by listing what it can actually do.

- User auth (sign up, sign in, sign out, session restore)
- User profile: edit data and upload avatar
- Posts: create, read, update, delete (CRUD) — with images (S3/MinIO)
- Post comments: create/edit/delete
- Post categories and tags
- Feed: search, sort, filters (date/categories/tags), pagination
- User preferred categories that affect the feed


## Project requirements

**Terminology:**
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

## Roles and permissions

**Terminology:**  
*Roles and permissions* describe what different types of users (guest vs authenticated) are allowed to do in the system. This ensures proper access control and feature availability.

| Role               | View posts | Create posts | Edit own posts | Comment | Manage comments | Moderation |
|--------------------|------------|--------------|----------------|---------|-----------------|------------|
| **Guest**          | ✅ Yes     | ❌ No        | ❌ No          | ❌ No   | ❌ No           | ❌ No      |
| **Authenticated**  | ✅ Yes     | ✅ Yes       | ✅ Yes         | ✅ Yes  | ✅ Own only     | ❌ No      |


Pages and key elements
- Home (feed): post previews, ordering by preferences, search, filters, buttons for sign in/register or profile and sign out for authorized users.
- Post page: title, full text, categories, tags, author, date, comments list and form (for authorized users).
- Create/Edit post: rich text editor, fields for title, categories, tags, buttons “Save as draft” and “Publish”.
- Profile: user info, avatar, selection of preferred categories, list of own posts with filtering.
- Auth pages: registration, login.


## System requirements

**Terminology:**  
*System requirements* specify the minimum software and tools needed to run the application, either via Docker or locally.

Minimum to run with Docker:
- Docker 24+
- Docker Compose v2

For local run without Docker (optional):
- Node.js 18+ and npm 9+
- MongoDB 7+
- MinIO (or any S3‑compatible store)


## Quick start (Docker)

**Terminology:**  
*Quick start* provides step‑by‑step instructions to set up and run the application quickly using Docker.

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

Environment variables are configuration values passed to the backend at runtime. They define database connections, storage endpoints, authentication secrets, and service ports.

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


## Available services (local, via Docker)
- http://localhost:5173 → Vue (hot reload)
- http://localhost:3000 → Node.js API (with nodemon)
- http://localhost:27017 → MongoDB (CLI/driver)
- http://localhost:8081 → Mongo Express GUI
- http://localhost:9001 → MinIO Console (login: minio / miniopass)
- http://localhost:9002 → MinIO S3 API


## Detailed backend documentation
For a deeper explanation of the backend architecture, endpoints, authentication flow, file uploads, pagination, health checks and troubleshooting, see:
- `BackEnd/README.md`

## Detailed frontend documentation
For a deeper explanation of the frontend architecture, key files, styles, API interaction and troubleshooting, see:
- `FrontEnd/README.md`

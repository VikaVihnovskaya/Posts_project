# FrontEnd — Architecture and Key Files

This folder contains the Vue 3 client application for ViPost. It provides the posts feed, post view, authentication, profile management, and post creation UI.

- Framework: Vue 3 (Vite)
- State: Pinia
- Router: Vue Router (history mode)
- Styles: CSS (global in src/style.css + scoped in SFCs)


## Quick start
- npm install
- npm run dev (default http://localhost:5173)
- npm run build
- npm run preview

---

## High‑level flow
1) index.html bootstraps the app and loads src/main.js.
2) main.js creates the Vue app, installs Pinia and the Router, and mounts App.vue.
3) App.vue renders <router-view/>, which displays a page component based on the current route.
4) Router guards check auth (via Pinia store) for protected pages before navigation.
5) Components (pages) fetch data from the Backend API (via fetch with credentials where needed) and render UI.


## Entry files
- index.html (project root of FrontEnd)
  - Vite HTML entry. Includes: <script type="module" src="/src/main.js"></script>
- src/main.js
  - Imports global styles and creates the Vue app with Pinia and Router.
- src/App.vue
  - App shell. Contains only <router-view/>. Page components render inside it.


## Folders overview
```
FrontEnd/
├── index.html                  # Entry HTML for Vite
├── public/                     # Static assets
├── src/
│    ├── main.js                # App bootstrap
│    ├── App.vue                # App shell
│    ├── style.css              # Global CSS
│    │
│    ├── router/                # Routing and guards
│    │     └── index.js
│    │
│    ├── stores/                # Pinia stores
│    │     ├── auth.js
│    │     └── preferences.js
│    │
│    ├── components/            # Pages + shared components
│    │     ├── Home.vue
│    │     ├── PostView.vue
│    │     ├── Profile.vue
│    │     ├── CreatePost.vue
│    │     ├── LoginUser.vue
│    │     ├── RegisterUser.vue
│    │     └── PostCard.vue
│    │
│    └── utils/ (Optional future improvement)
└── vite.config.js
```
- src/components — pages and reusable components
- src/router — Vue Router configuration and navigation guards
- src/stores — Pinia stores (auth state, user preferences)
- src/style.css — global styles
- public/ — static assets served as-is at the site root (e.g., /logo.png)


## Routing
Vue Router is configured in src/router/index.js.
- File: src/router/index.js
  - Declares routes:
    - / (Home) → components/Home.vue
    - /posts/:id (PostView) → components/PostView.vue
    - /profile (requiresAuth) → components/Profile.vue
    - /create (requiresAuth) → components/CreatePost.vue
    - /login → components/LoginUser.vue
    - /register → components/RegisterUser.vue

  - Global beforeEach guard:
    - Tries to restore session once on first navigation via auth.checkAuth().
    - If route has meta.requiresAuth and no user, redirects to Login with redirect=<target>.
    - If already authenticated and going to Login/Register — redirects to redirect or /profile.


## State management (Pinia stores)
- File: src/stores/auth.js (useAuthStore)
  - State: user, loading
  - Getters: isAuthenticated
  - Actions:
    - checkAuth(): GET /api/users (fallback /api/users/check). On success sets user.
    - login({ login, password }): POST /api/users/login with credentials: 'include', then checkAuth().
    - register({ login, password }): POST /api/users/create, then checkAuth().
    - logout(): POST /api/users/logout; clears user.
  - Notes:
    - safeJson helper parses JSON only if Content-Type is application/json.
    - All auth requests use credentials: 'include' to send cookies.

- File: src/stores/preferences.js (usePreferencesStore)
  - State: categories, selectedCategoryIds, loading, saving, error
  - Actions:
    - init(): loads categories (GET /api/categories) and current user preferences (GET /api/users/preferences).
    - save(categoryIds?): PUT /api/users/preferences with JSON body { categoryIds } → updates selectedCategoryIds.
    - reset(): DELETE /api/users/preferences → clears preferences.
  - Notes:
    - jsonOrThrow helper validates response status and JSON Content-Type.


## Key components (pages)
- Home.vue
  - Feed page with:
    - Search (debounced text query)
    - Filters: date from/to, categories (checkbox list), tags with match modes (contains/any/all/exact)
    - Sort by createdAt (asc/desc)
    - Pagination
    - Personalized ordering by preferred categories for authenticated users (server-side)
  - Uses PostCard.vue for list items.
  - Uses auth store to show Login/Register or Profile/Create/Logout actions.

- PostView.vue
  - Single post page: title, content, images, categories, tags, author, created date.
  - Comments section: list, create, edit, delete own comments (if authorized).

- Profile.vue (requires auth)
  - Edit profile info (name, email, about) and avatar upload/preview.
  - Manage preferred categories via usePreferencesStore (init/save/reset).
  - "My posts" list with filters by status and pagination.

- CreatePost.vue (requires auth)
  - Create new post: title, body, categories, tags, images.
  - Save as Draft or Publish.

- LoginUser.vue / RegisterUser.vue
  - Auth forms wired to useAuthStore actions (login/register).

- PostCard.vue
  - Card component used in the feed: preview image, title, metadata, author, categories/tags, and link to post.


## Styles
- Global CSS: src/style.css (base styles, layout helpers, variables).
- Scoped CSS: each .vue component may include its own <style scoped> section.
- Third-party styles: vue-multiselect styles imported in main.js.


## API interaction
- Plain fetch is used directly in stores/components.
- For authenticated endpoints, credentials: 'include' is set to send cookies.
- Expected backend base URL in development: relative /api/* proxied by Docker or Vite dev server configuration.


## Assets
- public/ contains static files available at runtime via absolute paths (e.g., /logo.png).
- Images uploaded by users are served by the backend/S3, not stored in the frontend repo.


## Development scripts
From the repository root:
- cd FrontEnd
- npm install
- npm run dev — start Vite dev server (default http://localhost:5173)
- npm run build — production build
- npm run preview — preview the production build locally


## Tips and conventions
- Keep API calls inside Pinia stores when they represent user/session or cross-page state (auth, preferences). Page-specific fetches can live in components.
- Always include credentials: 'include' when calling protected endpoints so the httpOnly JWT cookie is sent.
- Use route meta.requiresAuth and the global guard for protecting pages.
- Use lazy-loaded routes (dynamic imports) to split code by page.

---

## Table of contents
- High‑level flow
- Entry files
- Folders overview
- Routing
- State management
- Key components (pages)
- Styles
- API interaction
- Assets
- Development scripts
- Tips and conventions
- How feed filters and search work
- Auth and session: how it’s checked and used
- Typical user journeys
- Troubleshooting and common pitfalls


## How feed filters and search work
The Home page combines multiple inputs into a single query to the backend:
- Text search: a debounced query string is sent as you type. It matches title, categories and author.
- Date range: optional from/to dates constrain posts by createdAt.
- Categories: selecting checkboxes collects category IDs; empty = no category filter.
- Tags and match mode:
  - contains: post has at least one tag that contains the typed fragment.
  - any: post has any of the listed tags (OR).
  - all: post must contain all the listed tags (AND).
  - exact: exact tag name match using OR across provided tags.
- Sort: createdAt ascending or descending.
- Pagination: the UI tracks current page and total pages and asks the backend for the next/prev page.

The backend takes these parameters, applies them to MongoDB queries, and returns a normalized shape:
- items: array of posts for the page
- total: total count of matching posts
- page: current page index
- pageSize: items per page

Personalization: when the user is authenticated and has preferred categories, the backend orders results so that posts from preferred categories appear first.


## Auth and session: how it’s checked and used
- The backend sets an httpOnly JWT cookie on successful login.
- The frontend always includes credentials: 'include' on protected endpoints so the cookie is sent.
- At app start or first navigation, the router calls useAuthStore.checkAuth(). It tries GET /api/users (fallback /api/users/check) to retrieve the current user profile.
- If a protected route is opened without a valid session, the guard redirects to /login with ?redirect=<target> so, after logging in, the user returns to the intended page.
- On logout, the store calls POST /api/users/logout and clears the user in Pinia.


## Typical user journeys
- Guest browsing:
  1) Open Home → see public feed, use search/filters, open Post page.
- Sign in:
  1) Click Login, submit credentials → cookie is set → redirected back to redirect target or Profile.
- Create a post:
  1) From Home or Profile click Create Post → fill title/content/categories/tags → Publish or Save as Draft.
- Manage preferences:
  1) Open Profile → choose preferred categories → Save.
  2) Return to Home → preferred categories appear earlier in the feed ordering.
- Commenting:
  1) Open a post, write a comment, submit → comment appears; own comments can be edited/deleted.


## Troubleshooting and common pitfalls
- CORS/auth cookie not sent:
  - Ensure fetch calls to protected endpoints set credentials: 'include'.
  - When not using Docker, set proper CORS, cookie domain, and sameSite settings on the backend.
- Empty categories list:
  - Check that /api/categories responds OK; verify MongoDB has categories seeded.
- Session not restoring after refresh:
  - Verify that /api/users or /api/users/check is reachable and returns JSON when a valid cookie is present.
- Images not showing:
  - Ensure S3_PUBLIC_URL is configured and objects are publicly readable. In Docker, MinIO Console runs at http://localhost:9001.

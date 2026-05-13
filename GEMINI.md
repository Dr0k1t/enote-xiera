# GEMINI.md - Enote Xiera

Project documentation and instructions for Gemini CLI.

## Project Overview
**Enote** is a Single Page Application (SPA) designed for **Xiera**, a bakery in Ocotlán, Jalisco. It manages digital delivery notes ("notas de remisión") through a multi-user workflow.

- **Current Version:** v1.1 (Local with images).
- **Architecture:** Modular Vanilla JavaScript (ES Modules). No build step, no frameworks.
- **Persistence:** `localStorage` with an `enote_` prefix.
- **Future State (v1.2):** Migration to Supabase (SQL, Auth, Storage) + PWA (Offline-first). See `docs/ROADMAP-PRODUCCION-V1.2.md`.

## Key Commands
- **Development:** Use any static file server.
  ```bash
  npx serve .
  # or use VS Code Live Server (default port 5500)
  ```
- **Testing (Playwright E2E):**
  ```bash
  cd audit
  npm install
  npm run audit # Defaults to http://localhost:5500
  ```

## Project Structure
- `index.html`: Entry point and main container layout.
- `js/`: Application logic.
    - `app.js`: Main orchestrator, global state, and event delegation.
    - `config.js`: Configuration constants (users, roles, statuses, UI strings).
    - `store.js`: CRUD operations for `localStorage`.
    - `auth.js`: Session management and Role-Based Access Control (RBAC).
    - `ui.js`: HTML template generation (returns strings) and DOM updates.
    - `imageUtils.js`: Image compression (WebP 40%) for base64 storage.
- `css/`: Styling.
    - `variables.css`: Design tokens (colors, typography).
    - `main.css`: Component and layout styles.
    - `print.css`: Print/PDF specific layout.
- `docs/`: Planning and roadmap documents.
- `audit/`: E2E testing with Playwright.

## Development Conventions

### 1. Code Style & Organization
- **Surgical Edits:** Favor precise updates to existing modules over rewriting large sections.
- **Section Headers:** Use standardized headers for organization: `// ─── Title ─────`.
- **Naming:** Follow existing camelCase conventions and descriptive variable names.
- **Dates:** Store as ISO strings in `localStorage`. Format for the UI using `es-MX` (e.g., `formatFecha` in `ui.js`).

### 2. Implementation Patterns
- **HTML Templates:** UI is built using string concatenation in `ui.js`. Do NOT use JSX or heavy templating libraries.
- **Security:** ALWAYS escape user-generated content using the `esc()` function in `ui.js` before inserting into the DOM.
- **Event Delegation:** Centralized event handling in `app.js` using `setupEventDelegation()`.
- **State Management:** `app.js` holds ephemeral module-level state (e.g., `currentSession`, `editingNoteId`). Persistence is handled exclusively by `store.js`.

### 3. Workflow & Roles
- **Status Flow:** `Nueva` → `En Proceso` → `Completada` → `Cancelada`.
- **RBAC:** Roles (`admin`, `planta`, `sucursal`, `repartidor`) define permissions via `auth.js` and `config.js`.
- **Note Notifications:** `unreadNew` and `unreadModified` flags handle workflow visibility for the `planta` role.

## Important Notes
- **Base64 Images:** In v1.1, images are stored as Base64 WebP in `localStorage`. This is temporary and limited to 3 images per note to avoid storage limits.
- **Supabase Migration:** Keep the upcoming migration in mind. `store.js` and `auth.js` are the primary candidates for replacement in v1.2.
- **Cross-Tab Sync:** `app.js` listens for the `storage` event to refresh the UI when changes are made in other tabs.

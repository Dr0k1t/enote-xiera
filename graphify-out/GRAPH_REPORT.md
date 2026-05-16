# Graph Report - C:\Users\extre\Documentos\Enote\enote-xiera  (2026-05-15)

## Corpus Check
- 52 files · ~123,462 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 271 nodes · 582 edges · 24 communities (17 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core App Logic|Core App Logic]]
- [[_COMMUNITY_UI Rendering|UI Rendering]]
- [[_COMMUNITY_OfflineIndexedDB Layer|Offline/IndexedDB Layer]]
- [[_COMMUNITY_Architecture Concepts|Architecture Concepts]]
- [[_COMMUNITY_Image Compression|Image Compression]]
- [[_COMMUNITY_Server + Logger + ImageUtils|Server + Logger + ImageUtils]]
- [[_COMMUNITY_Authentication|Authentication]]
- [[_COMMUNITY_UI Screenshots|UI Screenshots]]
- [[_COMMUNITY_Security Audit Findings|Security Audit Findings]]
- [[_COMMUNITY_PWA + Offline + Roles|PWA + Offline + Roles]]
- [[_COMMUNITY_Playwright Audit Suite|Playwright Audit Suite]]
- [[_COMMUNITY_Sandbox Test Runner|Sandbox Test Runner]]
- [[_COMMUNITY_SprintRoadmap Planning|Sprint/Roadmap Planning]]
- [[_COMMUNITY_Sandbox Server|Sandbox Server]]
- [[_COMMUNITY_Status Workflow|Status Workflow]]
- [[_COMMUNITY_Repartidor View|Repartidor View]]
- [[_COMMUNITY_Service Worker|Service Worker]]
- [[_COMMUNITY_Vanilla JS Frontend|Vanilla JS Frontend]]
- [[_COMMUNITY_Final State Screenshot|Final State Screenshot]]
- [[_COMMUNITY_Root HTML|Root HTML]]
- [[_COMMUNITY_Agent Prompt Doc|Agent Prompt Doc]]
- [[_COMMUNITY_Sandbox Image 1|Sandbox Image 1]]
- [[_COMMUNITY_Sandbox Image 2|Sandbox Image 2]]
- [[_COMMUNITY_Sandbox Image 3|Sandbox Image 3]]

## God Nodes (most connected - your core abstractions)
1. `isDemoMode()` - 18 edges
2. `esc()` - 15 edges
3. `handleFormSubmit()` - 13 edges
4. `updateNote()` - 13 edges
5. `getNote()` - 12 edges
6. `getLocalNotes()` - 11 edges
7. `Audit Screenshots` - 11 edges
8. `handleDashboardClick()` - 9 edges
9. `showDetail()` - 9 edges
10. `CONFIG` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Vanilla JS Frontend` --implements--> `Enote Application`  [EXTRACTED]
  docs/ROADMAP-PRODUCCION-V1.2.md → index.html
- `Nota Management Workflow` --references--> `Form Nueva Nota`  [INFERRED]
  audit/screenshots/01-login.png → audit/screenshots/03-form-nueva.png
- `Nota Management Workflow` --references--> `Detalle Nota View`  [INFERRED]
  audit/screenshots/01-login.png → audit/screenshots/04-detalle-nota.png
- `Nota Management Workflow` --references--> `Final State View`  [INFERRED]
  audit/screenshots/01-login.png → audit/screenshots/06-final-state.png
- `Role-Based Access Control` --conceptually_related_to--> `Multi-Sucursal Support`  [INFERRED]
  audit/screenshots/02-dashboard-admin.png → audit/screenshots/07-dashboard-sucursal1.png

## Hyperedges (group relationships)
- **app.js como Orquestador Central** — js_app_js, js_store_js, js_auth_js, js_config_js, js_ui_shared_js, js_ui_login_js, js_ui_dashboard_js, js_ui_form_js, js_ui_detail_js, js_ui_repartidor_js [EXTRACTED 1.00]
- **MÃ³dulos UI Comparten shared.js** — js_ui_shared_js, js_ui_dashboard_js, js_ui_detail_js, js_ui_form_js, js_ui_login_js, js_ui_repartidor_js [EXTRACTED 1.00]
- **Offline: IndexedDB + Cola de SincronizaciÃ³n** — js_offline_js, js_store_js, js_ui_shared_js [EXTRACTED 1.00]
- **Auth: Dual Mode (Demo + Supabase)** — js_auth_js, js_supabase_js, js_config_js, js_store_js [EXTRACTED 1.00]
- **Data Layer: localStorage | Supabase** — js_store_js, js_supabase_js, js_offline_js [EXTRACTED 1.00]
- **RBAC + Status Workflow** — js_config_js, js_auth_js, js_store_js, js_app_js, role_admin, role_planta, role_sucursal, role_repartidor, status_nueva, status_en_proceso, status_completada, status_cancelada [EXTRACTED 1.00]
- **PWA: Service Worker + Cache** — sw_js, js_app_js, index_html [EXTRACTED 1.00]
- **Auto-transiciÃ³n Nuevaâ†’En Proceso para Planta** — js_app_js, js_store_js, note_entity, role_planta, status_nueva, status_en_proceso [EXTRACTED 1.00]
- **Flujo Diff: ConfirmaciÃ³n de Cambios en Estatus En Proceso/Completada** — js_app_js, js_ui_detail_js, js_store_js, note_entity, status_en_proceso, status_completada [EXTRACTED 1.00]
- **PWA Architecture Components** — pwa_offline, service_worker, indexeddb_storage, offline_queue [EXTRACTED 1.00]
- **Backend Stack** — supabase_backend, routes_table, profiles_table, notes_table, rls_policies [EXTRACTED 1.00]
- **User Roles** — role_admin, role_planta, role_sucursal, role_repartidor [EXTRACTED 1.00]
- **Security Issues Fixed by v1.2 Architecture** — sec002_hardcoded_credentials, sec003_rbac_bypass, sec006_no_validation, sec007_session_no_ttl, sec008_no_rate_limiting [EXTRACTED 1.00]
- **Quotation Documents** — enote_quotation_md, enote_quotation_html [EXTRACTED 1.00]
- **Sprint Weeks** — week0_prearranque, week1_infraestructura, week2_supabase_offline, week3_repartidor_pruebas, week4_deploy_entrega, week5_buffer [EXTRACTED 1.00]
- **E2E Test Workflow Audit** — login_screen_entity, dashboard_admin_entity, form_nueva_entity, detalle_nota_entity, dashboard_planta_entity, final_state_entity, dashboard_sucursal1_entity, form_sucursal1_entity, repartidor_view_entity, repartidor_sucursal1_entity [EXTRACTED 1.00]
- **Role-Based UI Views** — dashboard_admin_entity, dashboard_planta_entity, dashboard_sucursal1_entity, repartidor_view_entity [EXTRACTED 1.00]
- **Nota Lifecycle Screens** — form_nueva_entity, detalle_nota_entity, final_state_entity [INFERRED 0.85]

## Communities (24 total, 7 thin omitted)

### Community 0 - "Core App Logic"
Cohesion: 0.11
Nodes (52): applyFilters(), computeDiff(), confirmDelete(), debounce(), getBaseNotes(), getFilteredNotes(), handleConfirmStatus(), handleDashboardClick() (+44 more)

### Community 1 - "UI Rendering"
Cohesion: 0.18
Nodes (22): CONFIG, refreshGrid(), renderDashboardView(), renderEmptyState(), renderNoteCard(), renderStatusSelector(), renderDeleteConfirm(), renderDetailView() (+14 more)

### Community 2 - "Offline/IndexedDB Layer"
Cohesion: 0.21
Nodes (19): cacheImages(), createNoteOffline(), dbAdd(), dbClear(), dbDelete(), dbGet(), dbGetAll(), dbPut() (+11 more)

### Community 3 - "Architecture Concepts"
Cohesion: 0.11
Nodes (20): SincronizaciÃ³n Entre PestaÃ±as via storage event, AUDIT-V1.1.md - AuditorÃ­a TÃ©cnica, CLAUDE.md - DocumentaciÃ³n del Proyecto, GEMINI.md - DocumentaciÃ³n Gemini CLI, README.md - README Principal, Arquitectura Dual Mode (localStorage | Supabase), Enote v1.2 Quotation (HTML), Enote v1.2 Quotation (MD) (+12 more)

### Community 4 - "Image Compression"
Cohesion: 0.22
Nodes (18): PLAN-IMPLEMENTACION-IMAGENES.md - Plan de ImÃ¡genes, CompresiÃ³n de ImÃ¡genes WebP 40%, calculateReduction(), clearLog(), clearMemory(), compressImage(), displayComparison(), downloadLog() (+10 more)

### Community 5 - "Server + Logger + ImageUtils"
Cohesion: 0.12
Nodes (14): CORS, date, ext, filePath, files, fs, http, LOG_DIR (+6 more)

### Community 6 - "Authentication"
Cohesion: 0.16
Nodes (9): handleLogin(), getCurrentUser(), getSession(), login(), loginDemo(), loginSupabase(), setSession(), isSupabaseConfigured() (+1 more)

### Community 7 - "UI Screenshots"
Cohesion: 0.22
Nodes (15): Audit Screenshots, Admin Dashboard, Planta Dashboard, Sucursal1 Dashboard, Detalle Nota View, Enote System, Final State View, Form Nueva Nota (+7 more)

### Community 8 - "Security Audit Findings"
Cohesion: 0.2
Nodes (12): notes table, profiles table, routes table, SEC-001: Logout Broken, SEC-002: Hardcoded Credentials, SEC-004: Attribute Injection, SEC-005: esc() Incomplete, SEC-006: No Field Validation (+4 more)

### Community 9 - "PWA + Offline + Roles"
Cohesion: 0.2
Nodes (12): IndexedDB Storage, Last-Write-Wins Sync Strategy, Offline Queue Pattern, PDF Offline Capability, PWA Offline-First Architecture, RLS Policies, Rol: Admin, Rol: Planta (+4 more)

### Community 10 - "Playwright Audit Suite"
Cohesion: 0.29
Nodes (7): check(), { chromium }, fs, path, report, run(), SHOTS_DIR

### Community 11 - "Sandbox Test Runner"
Cohesion: 0.32
Nodes (7): fs, http, main(), MIME_TYPES, path, runTest(), startServer()

### Community 12 - "Sprint/Roadmap Planning"
Cohesion: 0.25
Nodes (8): Rol: Repartidor, Sprint Produccion v1.2, Vercel Hosting, Week 0: Pre-arranque, Week 1: Infraestructura, Week 3: Repartidor + Pruebas, Week 4: Deploy + Entrega, Week 5: Buffer

### Community 13 - "Sandbox Server"
Cohesion: 0.33
Nodes (5): fs, http, MIME_TYPES, path, server

### Community 14 - "Status Workflow"
Cohesion: 0.33
Nodes (6): Nota de RemisiÃ³n, Estatus: Cancelada, Estatus: Completada, Estatus: En Proceso, Estatus: Nueva, Flujo de Estatus: Nueva â†’ En Proceso â†’ Completada â†’ Cancelada

### Community 15 - "Repartidor View"
Cohesion: 0.6
Nodes (4): Rol Repartidor, Repartidor Vista Tomada, Repartidor Vista No Tomada, Toggle Tomada

### Community 16 - "Service Worker"
Cohesion: 0.5
Nodes (3): clone, STATIC_ASSETS, url

## Ambiguous Edges - Review These
- `Referencia Prueba Documento` → `Notas de RemisiÃ³n`  [AMBIGUOUS]
  docs/ref_prueba.jpeg · relation: references

## Knowledge Gaps
- **60 isolated node(s):** `http`, `fs`, `path`, `LOG_DIR`, `MIME` (+55 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Referencia Prueba Documento` and `Notas de RemisiÃ³n`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `Sprint Produccion v1.2` connect `Sprint/Roadmap Planning` to `PWA + Offline + Roles`, `Architecture Concepts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `Security Audit v1.0` connect `Security Audit Findings` to `PWA + Offline + Roles`, `Architecture Concepts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `PWA Offline-First Architecture` connect `PWA + Offline + Roles` to `Architecture Concepts`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `Enote - Sistema de Notas de RemisiÃ³n` (e.g. with `Enote v1.2 Quotation (MD)` and `Pricing Model`) actually correct?**
  _`Enote - Sistema de Notas de RemisiÃ³n` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `http`, `fs`, `path` to the rest of the system?**
  _60 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Core App Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
# aal-movies-DB

- Setup: Node `20.20.2`, `npm ci`, private `.env`, separate PostgreSQL database, `npm run dev`.
- Existing PostgreSQL databases: apply `scripts/add-user-deleted-at.sql` before starting the updated app.
- Commands: `npm test` and `npm start`.
- Contract: link to [`docs/team-contract.md`](docs/team-contract.md).
- Status: 261 tests pass across 13 suites. Auth, movies, Favorites, and
  transactional admin-only soft account deletion are integrated.
  Final PostgreSQL deletion rehearsal, presentation documentation,
  and release remain pending; cloud deployment optional.

## UML

## Model Diagram

```mermaid
classDiagram
    class Users {
        id
        username
        password
        role
        deletedAt
    }
    class Movies {
        id
        ownerId
        tmdbId
        title
        overview
        releaseDate
        posterPath
        status
        notes
    }
    class Favorites {
        id
        userId
        movieId
    }

    Users "1" --> "0..*" Movies : owns
    Users "1" --> "0..*" Favorites : saves
    Movies "1" --> "0..*" Favorites : receives
```

### Request-Flow Diagram

```mermaid
flowchart TD
    Client[REST client] --> App[Express app]
    App --> Public[Public routes]
    App --> Basic[Basic middleware]
    Basic --> Signin[Signin handler]
    App --> Bearer[Bearer middleware]
    Bearer --> Verify[Verify JWT and load current DB user]
    Verify --> Permit[permit capability]
    Permit --> Handler[Resource handler]
    Handler --> Ownership[Ownership or admin check where required]
    Ownership --> Models[Shared Sequelize models]
    Public --> Models
    Basic --> Models
    Verify --> Models
    Models --> DB[(PostgreSQL)]
    Models -. tests .-> SQLite[(SQLite in memory)]
    Handler --> TMDB[TMDB service for movie submission]
    Public --> Search[TMDB search service]
```

Public health bypasses the database.
Public stored-movie reads use the database.
Basic signin creates the token later verified by Bearer middleware.  
The diagram describes the planned complete system, including features still pending.

## changelog

### antonio - integration/deployment, and favorites

- `npm init -y` to create `package.json`.
- installed ` express`, `axios`, `dotenv`, `cors`, `jest`, `supertest`, `sequelize`,`pg` through `npm`.
- `git init` to tie to github repo.
- created simple express server; **`server.js`**.
  - transferred to `src/server.js`
- defined **`.env.example`**.
- created **`/docs/team-contract.md`** as a reminder of project scope and team responsibility shared reference.
  - updated policy regarding user account deletion.
- installed ` bcrypt@6.0.0` (password hashing), `jsonwebtoken@9.0.2` (token signing/verification), -dev `sqlite3@5.1.7` (test database).
- updated `"scripts"` to include `"start"` and `"dev"`, as well as add `"engines"` cmds; **`package.json`**.
- **`src/server.js`**;
  - Established Express health endpoint and separated startup,
  - mounted shared auth, movies, and Favorites routers,
  - `index.js`; startup entry.
- **`src/error-handlers`**;
  - created `404.js`, resource not found.
  - created `500.js`, invalid JSON parsing.
- **`server.js`**,
  - temp compatability entry to `index.js` (will remove after testing).
- `src/models/index.js`,
  - Configured shared database connection.
- **`jest.config.js`**;
  - discovers matching tests in test directory.
- **`__tests__/integration/foundation.test.js`**;
  - foundation tests that cover observable behavior and SQLite connectivity.
    - not model constarints,ownership, or PostgreSQL connectivity.
- **`.github/workflows/ci.yml`**;
  - installs from lockfile and runs same test cmd; w/o PostgreSQL nor TMDB creds.
- Verified health, error responses, and SQLite connectivity; `__tests__/integration/foundation.test.js` — 4 tests passed.
- Verified PostgreSQL startup and HTTP health response; `index.js`, `GET /health`.
- **`src/favorites/favorite-model.js`**;
  - added Favorites model and duplicate constraints factory.
- **`src/models/index.js`**;
  - registered shared models and enforced relationships and movie deletion cascade, 
- **`index.js`**
  - initialized missing DB tables during startup, before listening; `await db.sync();`.
- **`__tests__/auth/user-model.test.js`**
  - updated to import `{ db`, `users: User }` from `../../src/models`
- **`__tests__/integration/models.test.js`**;
  - Verified shared model constraints and movie-to-favorites cascade.
- Added authenticated Favorites listing, creation, and owner/admin removal; **`src/favorites/router.js`**, **`src/favorites/handlers.js`**.
- Verified Favorites isolation, ownership, and movie deletion cascade with real authentication; **`__tests__/favorites/routes.test.js`**.
- Added transactional admin-only account deletion and authentication exclusion;
  - **`src/auth/router.js`**, **`src/auth/user-model.js`**;
- cleaned signup; 
- **`src/auth/bearer.js`**;
  - Forwarded unexpected Bearer failures to the server error handler
- **`src/movies/handlers.js`**;
  - Preserved limited former-owner display on public movie reads; `publicOwnerInclude`.
- **`scripts/add-user-deleted-at.sql`**;
  - Added the existing-database soft-delete column update; 
- Verified account deletion, retained records, and rollback behavior; 
  - **`__tests__/integration/account-deletion.test.js`**;

### amity - movies

### luis - users
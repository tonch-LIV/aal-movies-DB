# SHARED TEAM CONTRACT — MOVIE LOGGER BACKEND

Assignment:
One Express backend demonstrating database CRUD, Basic/Bearer
authentication, authorization, and team understanding. Seven-day deadline.
Per the instructor's in-person clarification, a working local backend demonstrated through curl/REST-client requests and terminal test commands satisfies the functionality requirement. Cloud deployment is an optional stretch goal.
No frontend. Pair/review together; ownership coordinates work, it does not mean three independent projects.

Stack:
CommonJS, Express, Sequelize, PostgreSQL for development/deployment,
SQLite in memory for tests, Jest and Supertest.
Use the team's agreed Node version and dependencies. One shared Sequelize
connection. Do not introduce a second app, ORM, or authentication system.

Scope:
One implicit personal movie list per user.
Movie submissions are publicly readable.
Users may update or delete their own movie entries/submissions.
admins may update or delete any entry.
Authenticated users can favorite any existing submitted entry.
Users can remove their own favorites; admins can remove any favorite.
Favoriting an entry does not grant editing/deleting rights or create another movie entry.

Models:
Users: id, username(unique), password(hash), role(user/admin), deletedAt.
Movies: id, ownerId, tmdbId, title, overview, releaseDate, posterPath,
        status(planned/watched, default planned), notes.
Favorites: id, userId, movieId.
Unique Movies(ownerId, tmdbId); unique Favorites(userId, movieId).
Foreign keys must be enforced. Deleting a movie removes its Favorites.

Movie rows are owned list entries, not globally unique films.
Different users may submit the same tmdbId.
No separate Lists table, named playlists, ratings, reviews, or frontend.

Database relationships:
The integration/favorites owner registers all supplied model factories and defines associations centrally in src/models/index.js.

| Relationship | Alias | Foreign key |
| --- | --- | --- |
| users hasMany movies | movies | ownerId |
| movies belongsTo users | owner | ownerId |
| users hasMany favorites | favorites | userId |
| favorites belongsTo users | user | userId |
| movies hasMany favorites | favorites | movieId |
| favorites belongsTo movies | movie | movieId |

ownerId, userId, and movieId are required foreign keys.
They must reference existing local records.
Deleting a movie cascades deletion to its associated Favorites.

Account deletion:
Only admins may delete accounts through DELETE /users/:id.
Deletion is soft deletion: the Users row remains with deletedAt set.
Deleted users cannot sign in or authenticate with existing tokens.
Their movie submissions remain, retaining ownerId and displaying the
former username through an explicitly limited public-user projection.
Favorites belonging to the deleted user are removed transactionally.
Other users' favorites on those movies remain.
Only admins may modify movies whose owner account is deleted.
Deleted usernames remain reserved.
Successful deletion returns 204 without a body.

Shared exports:
src/models/index.js exports { db, users, movies, favorites }.
Model files export factory functions (sequelize, DataTypes) => model.
src/server.js exports { app, start }.
Importing app must not start listening or synchronize the database.

Ownership:

Integration/favorites owner (project lead):
index.js, src/server.js, src/models/index.js, src/error-handlers/,
src/favorites/, __tests__/favorites/, __tests__/integration/,
package.json, package-lock.json, jest.config.js, .gitignore,
.env.example, .github/, README.md, docs/team-contract.md.

User owner:
src/auth/, scripts/create-admin.js, __tests__/auth/.

Movies owner:
src/movies/, src/services/tmdb.js, __tests__/movies/.

Ownership verification:
Using two regular users and one admin, verify:
- User A can update/delete A's entry.
- User B cannot update/delete A's entry: 403.
- Favoriting A's entry does not give B permission to modify it.
- Admin can update/delete either user's entry.
- Deleting an entry removes its associated favorites.
- Client-supplied ownerId cannot assign or transfer ownership.

Auth interfaces:
src/auth/basic.js exports Basic middleware.
src/auth/bearer.js exports Bearer middleware attaching the current database
user to req.user.
src/auth/permissions.js exports permit(capability).
Role capabilities: 
- user: read, create, update, delete
- admin: read, create, update, delete

Capabilities permit an operation in principle.
Movie update/delete handlers must additionally require ownership or admin.
Matching capabilities do not give regular users access to other users' entries.
Ownership checks are additionally implemented by each resource owner.
Unknown roles are denied. Signup always assigns user; no public escalation.
Admin setup is explicit and never hardcodes committed credentials.

Routes:
POST /signup — JSON username/password; 201.
POST /signin — Basic header; 200.
DELETE /users/:id — Bearer + explicit admin-only check; soft delete account and remove its favorites transactionally; 204.
Auth body: { user: { id, username, role }, token }.
GET /health — public; 200 { status: "ok" }.

GET /movies/search?q=... — public TMDB search, normalized results.
GET /movies — public stored entries; optional ownerId filter.
GET /movies/:id — public stored entry.
POST /movies — Bearer + create; body tmdbId, optional status/notes.
Server retrieves TMDB metadata and derives ownerId from req.user.
PUT /movies/:id — Bearer + update + owner-or-admin; status/notes only.
DELETE /movies/:id — Bearer + delete; owner-or-admin; 204.

GET /favorites — Bearer; own favorites by default.
Admin may explicitly filter another user's favorites using userId.
POST /favorites — Bearer; body movieId; userId comes from req.user.
DELETE /favorites/:id — Bearer; own favorite or admin; 204.

Successful GET/PUT = 200; POST = 201; DELETE = 204 without a body.
Lists return arrays; individual resources return objects.
Errors: { error: "Readable message" }.
400 invalid input; 401 missing/invalid login; 403 forbidden;
404 missing resource; 409 duplicate username/submission/favorite;
502 external-provider failure; 504 external-provider timeout.
No credentials, password hashes, or raw provider errors in responses.

TMDB:
Use a server-only TMDB_READ_ACCESS_TOKEN.
Service exports searchMovies(query) and getMovieDetails(tmdbId).
Normalize metadata to tmdbId, title, overview, releaseDate, posterPath.
Never accept an arbitrary provider URL from the client.
Validate input, encode search parameters, bound requests with a timeout,
and mock external requests in automated tests.
Store selected metadata locally. Reads/updates of stored entries do not
depend on live TMDB.
Include TMDB attribution in project Credits.

JWT:
15-minute expiration, SECRET from environment, signature verification,
and current database-user lookup. Authorization uses the current DB role.
Optional issuer/audience checks may be reused only if all teammates agree
on the configuration and tests. They are not a new scope requirement.

Git:
One repository and shared dev branch.
Antonio uses feature/integration. The user and movies owners choose and announce their feature branch names before beginning work.
Feature PRs target dev. Antonio coordinates shared-file changes and performs all merges into dev and main.
Each person supplies tests, example requests, and documentation notes.
No unilateral contract changes: propose them to the team first.

Teaching mode:
Assume basic programming knowledge and beginner confidence.
Guide us through implementation; do not edit files, install packages,
run tests, or change Git/external state without explicit authorization.
Read-only inspections are allowed after stating exact commands, what their
arguments mean, and what you intend to inspect.
Explain exact file locations, reasoning, and expected behavior.
Group related implementation, tests, and documentation into coherent
assignment-sized checkpoints. Stop for our results after each checkpoint.
Review current code and supplied output before advancing.
Do not repeatedly test unchanged behavior or expand scope with extras.

INTERFACE AND NAMING AGREEMENT

The shared contract is stored in docs/team-contract.md in our repository.
All three developers start from the same committed version.

These names are fixed unless the team agrees to a change:

- Shared models: { db, users, movies, favorites }
- Authenticated user: req.user
- Account role: req.user.role
- Ownership field on Movies: ownerId
- Favorite account field: userId
- Favorite local movie reference: movieId
- External TMDB identifier: tmdbId
- Local primary key: id
- Route record identifier: req.params.id
- Search parameter: req.query.q
- Role middleware: permit(capability)

CommonJS exports — each line describes a separate file:

src/auth/user-model.js:
  module.exports = userModel;

src/movies/movie-model.js:
  module.exports = movieModel;

src/favorites/favorite-model.js:
  module.exports = favoriteModel;

Each model factory accepts (sequelize, DataTypes) and returns its model.

src/auth/basic.js:
  module.exports = basic;

src/auth/bearer.js:
  module.exports = bearer;

src/auth/permissions.js:
  module.exports = permit;

Each router.js file:
  module.exports = router;

src/services/tmdb.js:
  module.exports = { searchMovies, getMovieDetails };

src/models/index.js:
  module.exports = { db, users, movies, favorites };

src/server.js:
  module.exports = { app, start };

Routers use relative paths. The integration lead mounts:
- auth router at "/"
- movies router at "/movies"
- favorites router at "/favorites"

Internal helper names may differ freely inside an owned module.
Exported names, field names, route paths, and response shapes must match
the contract exactly, including capitalization.

Before changing a shared interface:
1. Propose the change to teammates.
2. Identify affected imports, routes, tests, and documentation.
3. Agree on the change and update the contract.
4. Coordinate implementation before merging.

Proposed structure:
index.js
package.json
package-lock.json
jest.config.js
.gitignore
.env.example
README.md
docs/
  team-contract.md
src/
  server.js
  models/
    index.js
  auth/
    user-model.js
    router.js
    basic.js
    bearer.js
    permissions.js
  movies/
    movie-model.js
    router.js
    handlers.js
  favorites/
    favorite-model.js
    router.js
    handlers.js
  services/
    tmdb.js
  error-handlers/
    404.js
    500.js
scripts/
  create-admin.js
__tests__/
  auth/
  movies/
  favorites/
  integration/
.github/
  workflows/
    ci.yml
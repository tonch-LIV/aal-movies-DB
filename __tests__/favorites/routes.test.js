'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/server');
const { db, users, movies, favorites } = require('../../src/models');

const previousSecret = process.env.SECRET;

let userA;
let userB;
let admin;
let movieA;
let tokenA;
let tokenB;
let adminToken;

function tokenFor(user) {
  return jwt.sign(
    { id: user.id },
    process.env.SECRET,
    { expiresIn: '15m' },
  );
}

function authorized(method, path, token) {
  return request(app)[method](path)
    .set('Authorization', `Bearer ${token}`);
}

beforeAll(() => {
  process.env.SECRET = 'favorites-test-secret';
});

beforeEach(async () => {
  if (db.getDialect() !== 'sqlite' || db.options.storage !== ':memory:') {
    throw new Error('These tests require in-memory SQLite');
  }

  await db.sync({ force: true });

  userA = await users.create({
    username: 'favorite-a',
    password: 'password-a',
  });

  userB = await users.create({
    username: 'favorite-b',
    password: 'password-b',
  });

  admin = await users.create({
    username: 'favorite-admin',
    password: 'password-admin',
    role: 'admin',
  });

  movieA = await movies.create({
    ownerId: userA.id,
    tmdbId: 550,
    title: 'Stored movie',
  });

  tokenA = tokenFor(userA);
  tokenB = tokenFor(userB);
  adminToken = tokenFor(admin);
});

afterAll(async () => {
  await db.close();

  if (previousSecret === undefined) {
    delete process.env.SECRET;
  } else {
    process.env.SECRET = previousSecret;
  }
});

test.each([
  ['get', '/favorites'],
  ['post', '/favorites'],
  ['delete', '/favorites/1'],
])('%s %s requires authentication', async (method, path) => {
  const response = await request(app)[method](path);

  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: expect.any(String) });
});

test('signin returns a token that accesses Favorites', async () => {
  const signin = await request(app)
    .post('/signin')
    .auth(userB.username, 'password-b');

  expect(signin.status).toBe(200);
  expect(signin.body.user).toEqual({
    id: userB.id,
    username: userB.username,
    role: 'user',
  });

  const response = await authorized(
    'get',
    '/favorites',
    signin.body.token,
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual([]);
});

test('B can favorite A’s movie without changing ownership or copying it', async () => {
  const response = await authorized('post', '/favorites', tokenB)
    .send({ movieId: movieA.id, userId: userA.id });

  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({
    id: expect.any(Number),
    userId: userB.id,
    movieId: movieA.id,
  });
  expect(response.body.password).toBeUndefined();

  await movieA.reload();
  expect(movieA.ownerId).toBe(userA.id);
  expect(await movies.count()).toBe(1);
});

test('duplicate Favorites return 409', async () => {
  await favorites.create({ userId: userB.id, movieId: movieA.id });

  const response = await authorized('post', '/favorites', tokenB)
    .send({ movieId: movieA.id });

  expect(response.status).toBe(409);
  expect(response.body).toEqual({ error: 'Movie already favorited' });
  expect(await favorites.count()).toBe(1);
});

test.each([
  {},
  { movieId: 0 },
  { movieId: -1 },
  { movieId: 1.5 },
  { movieId: '1' },
  { movieId: null },
  [],
])('POST rejects invalid input %p', async (body) => {
  const response = await authorized('post', '/favorites', tokenB)
    .send(body);

  expect(response.status).toBe(400);
  expect(await favorites.count()).toBe(0);
});

test('POST returns 404 for a missing movie', async () => {
  const response = await authorized('post', '/favorites', tokenB)
    .send({ movieId: 999999 });

  expect(response.status).toBe(404);
  expect(await favorites.count()).toBe(0);
});

test('GET returns only the requester’s favorites by default', async () => {
  const own = await favorites.create({
    userId: userA.id,
    movieId: movieA.id,
  });

  await favorites.create({ userId: userB.id, movieId: movieA.id });

  const response = await authorized('get', '/favorites', tokenA);

  expect(response.status).toBe(200);
  expect(response.body.map((record) => record.id)).toEqual([own.id]);

  const adminDefault = await authorized('get', '/favorites', adminToken);
  expect(adminDefault.status).toBe(200);
  expect(adminDefault.body).toEqual([]);
});

test('only an admin may select another account’s favorites', async () => {
  const favorite = await favorites.create({
    userId: userA.id,
    movieId: movieA.id,
  });

  const path = `/favorites?userId=${userA.id}`;

  const denied = await authorized('get', path, tokenB);
  expect(denied.status).toBe(403);

  const allowed = await authorized('get', path, adminToken);
  expect(allowed.status).toBe(200);
  expect(allowed.body.map((record) => record.id)).toEqual([favorite.id]);
});

test.each(['0', '-1', 'abc', '1.5'])('invalid userId filter %s returns 400', async (id) => {
  const response = await authorized(
    'get',
    `/favorites?userId=${id}`,
    adminToken,
  );

  expect(response.status).toBe(400);
});

test('another user cannot delete a favorite; its owner can', async () => {
  const favorite = await favorites.create({
    userId: userA.id,
    movieId: movieA.id,
  });

  const path = `/favorites/${favorite.id}`;

  const denied = await authorized('delete', path, tokenB);
  expect(denied.status).toBe(403);
  expect(await favorites.findByPk(favorite.id)).not.toBeNull();

  const removed = await authorized('delete', path, tokenA);
  expect(removed.status).toBe(204);
  expect(removed.text).toBe('');
  expect(await favorites.findByPk(favorite.id)).toBeNull();
  expect(await movies.findByPk(movieA.id)).not.toBeNull();
});

test('an admin can delete another account’s favorite', async () => {
  const favorite = await favorites.create({
    userId: userB.id,
    movieId: movieA.id,
  });

  const response = await authorized(
    'delete',
    `/favorites/${favorite.id}`,
    adminToken,
  );

  expect(response.status).toBe(204);
  expect(response.text).toBe('');
  expect(await favorites.findByPk(favorite.id)).toBeNull();
});

test('DELETE distinguishes invalid IDs and missing records', async () => {
  const invalid = await authorized('delete', '/favorites/abc', tokenA);
  expect(invalid.status).toBe(400);

  const missing = await authorized('delete', '/favorites/999999', tokenA);
  expect(missing.status).toBe(404);
});

test('favoriting does not give B permission to modify A’s entry', async () => {
  await authorized('post', '/favorites', tokenB)
    .send({ movieId: movieA.id })
    .expect(201);

  await authorized('put', `/movies/${movieA.id}`, tokenB)
    .send({ notes: 'Unauthorized change' })
    .expect(403);

  await authorized('delete', `/movies/${movieA.id}`, tokenB)
    .expect(403);

  await movieA.reload();
  expect(movieA.notes).toBeNull();
});

test('an authorized movie deletion removes its associated Favorites', async () => {
  await favorites.create({ userId: userB.id, movieId: movieA.id });

  const response = await authorized(
    'delete',
    `/movies/${movieA.id}`,
    tokenA,
  );

  expect(response.status).toBe(204);
  expect(response.text).toBe('');
  expect(await favorites.count()).toBe(0);
});

test('authorization uses the current database role', async () => {
  // The token was issued while this account was an admin.
  await admin.update({ role: 'user' });

  const response = await authorized(
    'get',
    `/favorites?userId=${userA.id}`,
    adminToken,
  );

  expect(response.status).toBe(403);
});
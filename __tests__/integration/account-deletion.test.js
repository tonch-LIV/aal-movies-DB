'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../../src/server');
const { db, users, movies, favorites } = require('../../src/models');

const previousSecret = process.env.SECRET;
let userA, userB, admin, movieA, tokenA, tokenB, adminToken;

function tokenFor(user) {
  return jwt.sign(
    { id: user.id },
    process.env.SECRET,
    { expiresIn: '15m' }
  );
}

function authorized(method, path, token) {
  return request(app)[method](path)
    .set('Authorization', `Bearer ${token}`);
}

beforeAll(() => {
  process.env.SECRET = 'account-deletion-test-secret';
});

beforeEach(async () => {
  if (db.getDialect() !== 'sqlite' || db.options.storage !== ':memory:') {
    throw new Error('These tests require in-memory SQLite');
  }

  await db.sync({ force: true });

  userA = await users.create({
    username: 'account-a',
    password: 'password-a',
  });

  userB = await users.create({
    username: 'account-b',
    password: 'password-b',
  });

  admin = await users.create({
    username: 'account-admin',
    password: 'password-admin',
    role: 'admin',
  });

  movieA = await movies.create({
    ownerId: userA.id,
    tmdbId: 603,
    title: 'Stored movie',
  });

  await favorites.bulkCreate([
    { userId: userA.id, movieId: movieA.id },
    { userId: userB.id, movieId: movieA.id },
  ]);

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

test('account deletion requires authentication and an admin role', async () => {
  const path = `/users/${userA.id}`;

  await request(app).delete(path).expect(401);
  await authorized('delete', path, tokenB).expect(403);

  expect(await users.findByPk(userA.id)).not.toBeNull();
  expect(await favorites.count()).toBe(2);
});

test('admin soft deletion preserves movies and other users’ favorites', async () => {
  const response = await authorized(
    'delete', `/users/${userA.id}`, adminToken
  );

  expect(response.status).toBe(204);
  expect(response.text).toBe('');

  expect(await users.findByPk(userA.id)).toBeNull();

  const retained = await users.findByPk(userA.id, { paranoid: false });
  expect(retained.username).toBe(userA.username);
  expect(retained.deletedAt).not.toBeNull();

  expect((await movies.findByPk(movieA.id)).ownerId).toBe(userA.id);
  expect(await favorites.count({ where: { userId: userA.id } })).toBe(0);
  expect(await favorites.count({ where: { userId: userB.id } })).toBe(1);

  const one = await request(app).get(`/movies/${movieA.id}`).expect(200);
  expect(one.body.owner).toEqual({
    id: userA.id,
    username: userA.username,
  });

  const list = await request(app)
    .get(`/movies?ownerId=${userA.id}`)
    .expect(200);

  expect(list.body[0].owner).toEqual(one.body.owner);
});

test('deleted accounts cannot sign in, reuse tokens, or reclaim usernames', async () => {
  await authorized('delete', `/users/${userA.id}`, adminToken).expect(204);

  await request(app)
    .post('/signin')
    .auth(userA.username, 'password-a')
    .expect(401);

  await authorized('get', '/favorites', tokenA).expect(401);

  await request(app)
    .post('/signup')
    .send({ username: userA.username, password: 'replacement-password' })
    .expect(409);
});

test('only admins can modify a deleted owner’s movie', async () => {
  await authorized('delete', `/users/${userA.id}`, adminToken).expect(204);

  await authorized('put', `/movies/${movieA.id}`, tokenA)
    .send({ notes: 'Deleted account' })
    .expect(401);

  await authorized('put', `/movies/${movieA.id}`, tokenB)
    .send({ notes: 'Another user' })
    .expect(403);

  await authorized('delete', `/movies/${movieA.id}`, tokenB).expect(403);

  await authorized('put', `/movies/${movieA.id}`, adminToken)
    .send({ notes: 'Admin update' })
    .expect(200);

  await authorized('delete', `/movies/${movieA.id}`, adminToken).expect(204);
  expect(await favorites.count()).toBe(0);
});

test('invalid, missing, and already deleted accounts are distinguished', async () => {
  await authorized('delete', '/users/abc', adminToken).expect(400);
  await authorized('delete', '/users/999999', adminToken).expect(404);

  const path = `/users/${userA.id}`;
  await authorized('delete', path, adminToken).expect(204);
  await authorized('delete', path, adminToken).expect(404);
});

test('a deletion failure rolls back favorite removal', async () => {
  const spy = jest.spyOn(users.prototype, 'destroy')
    .mockRejectedValueOnce(new Error('Private database failure'));

  try {
    const response = await authorized(
      'delete', `/users/${userA.id}`, adminToken
    );

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Internal server error' });
    expect(await favorites.count()).toBe(2);
    expect(await users.findByPk(userA.id)).not.toBeNull();
  } finally {
    spy.mockRestore();
  }
});
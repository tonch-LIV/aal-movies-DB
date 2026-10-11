'use strict';

// Virtual mocks allow these tests to run before the auth branch is integrated.
jest.mock('../../src/auth/bearer', () => jest.fn((req, res, next) => {
  if (req.headers.authorization !== 'Bearer test-token') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  req.user = { id: 2, role: 'user' };
  next();
}), { virtual: true });
jest.mock('../../src/auth/permissions', () => jest.fn(() => jest.fn((req, res, next) => next())), { virtual: true });
jest.mock('../../src/movies/handlers', () => Object.fromEntries(
  ['search', 'getAll', 'getOne', 'create', 'update', 'remove'].map((name) => [name, jest.fn((req, res) => {
    if (name === 'remove') return res.status(204).send();
    return res.status(name === 'create' ? 201 : 200).json({ handler: name });
  })]),
));
const express = require('express');
const request = require('supertest');
const bearer = require('../../src/auth/bearer');
const permit = require('../../src/auth/permissions');
const handlers = require('../../src/movies/handlers');
const router = require('../../src/movies/router');
const permissionMiddleware = permit.mock.results.map((result) => result.value);
const permissionCalls = permit.mock.calls.map((args) => [...args]);
const app = express();
app.use(express.json());
app.use('/movies', router);
beforeEach(() => jest.clearAllMocks());
const routes = [
  ['get', '/movies/search?q=movie', 'search', 200],
  ['get', '/movies', 'getAll', 200],
  ['get', '/movies/1', 'getOne', 200],
  ['post', '/movies', 'create', 201],
  ['put', '/movies/1', 'update', 200],
  ['delete', '/movies/1', 'remove', 204],
];
test('exports exactly the six agreed routes with the correct middleware order', () => {
  const entries = router.stack.filter((layer) => layer.route).map((layer) => layer.route);
  expect(entries.map((route) => [Object.keys(route.methods)[0], route.path])).toEqual([
    ['get', '/search'], ['get', '/'], ['get', '/:id'],
    ['post', '/'], ['put', '/:id'], ['delete', '/:id'],
  ]);
  entries.slice(0, 3).forEach((route) => expect(route.stack).toHaveLength(1));
  entries.slice(3).forEach((route, index) => {
    expect(route.stack.map((layer) => layer.handle)).toEqual([
      bearer, permissionMiddleware[index], handlers[['create', 'update', 'remove'][index]],
    ]);
    expect(permissionCalls[index]).toEqual([['create', 'update', 'delete'][index]]);
  });
});
test.each(routes)('%s %s reaches %s', async (method, path, name, status) => {
  let pending = request(app)[method](path);
  if (method !== 'get') pending = pending.set('Authorization', 'Bearer test-token');
  const response = await pending;
  expect(response.status).toBe(status);
  expect(handlers[name]).toHaveBeenCalledTimes(1);
  if (method === 'get') expect(bearer).not.toHaveBeenCalled();
  else {
    expect(bearer).toHaveBeenCalledTimes(1);
    expect(handlers[name].mock.calls[0][0].user).toEqual({ id: 2, role: 'user' });
  }
  if (name === 'search') expect(handlers.getOne).not.toHaveBeenCalled();
  if (status === 204) expect(response.text).toBe('');
});
test.each(routes.slice(3))('%s %s rejects missing authentication', async (method, path, name) => {
  const response = await request(app)[method](path);
  expect(response.status).toBe(401);
  expect(response.body).toEqual({ error: 'Invalid token' });
  expect(handlers[name]).not.toHaveBeenCalled();
});
test.each(routes.slice(3))('%s %s stops when permission middleware denies access', async (method, path, name) => {
  const index = ['create', 'update', 'remove'].indexOf(name);
  permissionMiddleware[index].mockImplementationOnce((req, res) => res.status(403).json({ error: 'Forbidden' }));
  const response = await request(app)[method](path).set('Authorization', 'Bearer test-token');
  expect(response.status).toBe(403);
  expect(handlers[name]).not.toHaveBeenCalled();
});

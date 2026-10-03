'use strict';

const request = require('supertest');
const { app } = require('../../src/server');
const { db } = require('../../src/models');

afterAll(async () => {
  await db.close();
});

test('GET /health returns the public health response', async () => {
  const response = await request(app).get('/health');

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok' });
});

test('unknown routes return the agreed error shape', async () => {
  const response = await request(app).get('/missing');

  expect(response.status).toBe(404);
  expect(response.body).toEqual({ error: 'Resource not found' });
});

test('malformed JSON returns 400', async () => {
  const response = await request(app)
    .post('/health')
    .set('Content-Type', 'application/json')
    .send('{"broken":');

  expect(response.status).toBe(400);
  expect(response.body).toEqual({ error: 'Invalid JSON body' });
});

test('the test database uses an in-memory SQLite connection', async () => {
  expect(db.getDialect()).toBe('sqlite');
  expect(db.options.storage).toBe(':memory:');

  await db.authenticate();
});
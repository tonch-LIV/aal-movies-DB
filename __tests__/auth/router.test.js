'use strict';

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

jest.mock('../../src/models', () => ({
  users: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
}));

const { users } = require('../../src/models');
const router = require('../../src/auth/router');

describe('Auth Router', () => {

  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.SECRET = 'test-secret';

    app = express();
    app.use(express.json());
    app.use(router);
  });

  test('POST /signup creates a user and returns a token', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      password: 'hashed-password',
      role: 'user',
    };

    users.create.mockResolvedValue(mockUser);

    const response = await request(app)
      .post('/signup')
      .send({
        username: 'testuser',
        password: 'password123',
        role: 'admin',
      });

    expect(response.status).toBe(201);

    expect(users.create).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'password123',
      role: 'user',
    });

    expect(response.body.user).toEqual({
      id: 1,
      username: 'testuser',
      role: 'user',
    });

    expect(response.body.user.password).toBeUndefined();
    expect(response.body.token).toBeDefined();

    const decoded = jwt.verify(
      response.body.token,
      process.env.SECRET
    );

    expect(decoded.id).toBe(1);
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  test('POST /signup rejects missing credentials', async () => {
    const response = await request(app)
      .post('/signup')
      .send({
        username: 'testuser',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Valid username and password are required',
    });

    expect(users.create).not.toHaveBeenCalled();
  });

  test('POST /signup rejects an absent request body', async () => {
    const response = await request(app)
      .post('/signup');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Valid username and password are required',
    });

    expect(users.create).not.toHaveBeenCalled();
  });

  test.each([
    ['blank username', '   ', 'password123'],
    ['blank password', 'testuser', '   '],
    ['empty username', '', 'password123'],
    ['empty password', 'testuser', ''],
    ['numeric username', 123, 'password123'],
    ['numeric password', 'testuser', 123],
    ['object username', { value: 'testuser' }, 'password123'],
    ['object password', 'testuser', { value: 'password123' }],
    ['null username', null, 'password123'],
    ['null password', 'testuser', null],
  ])(
    'POST /signup rejects %s',
    async (description, username, password) => {
      const response = await request(app)
        .post('/signup')
        .send({ username, password });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Valid username and password are required',
      });

      expect(users.create).not.toHaveBeenCalled();
    }
  );

  test('POST /signup rejects a duplicate username', async () => {
    const error = new Error('duplicate username');
    error.name = 'SequelizeUniqueConstraintError';

    users.create.mockRejectedValue(error);

    const response = await request(app)
      .post('/signup')
      .send({
        username: 'testuser',
        password: 'password123',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: 'Username already exists',
    });
  });

  test('POST /signin authenticates a user and returns a token', async () => {
    const hashedPassword = await bcrypt.hash(
      'password123',
      10
    );

    const mockUser = {
      id: 1,
      username: 'testuser',
      password: hashedPassword,
      role: 'user',
    };

    users.findOne.mockResolvedValue(mockUser);

    const credentials = Buffer
      .from('testuser:password123')
      .toString('base64');

    const response = await request(app)
      .post('/signin')
      .set('Authorization', `Basic ${credentials}`);

    expect(response.status).toBe(200);

    expect(response.body.user).toEqual({
      id: 1,
      username: 'testuser',
      role: 'user',
    });

    expect(response.body.user.password).toBeUndefined();
    expect(response.body.token).toBeDefined();

    const decoded = jwt.verify(
      response.body.token,
      process.env.SECRET
    );

    expect(decoded.id).toBe(1);
    expect(decoded.exp - decoded.iat).toBe(900);
  });

  test('POST /signin accepts a password containing a colon', async () => {
    const hashedPassword = await bcrypt.hash('pass:word', 10);

    users.findOne.mockResolvedValue({
      id: 2,
      username: 'testuser',
      password: hashedPassword,
      role: 'user',
    });

    const credentials = Buffer
      .from('testuser:pass:word')
      .toString('base64');

    const response = await request(app)
      .post('/signin')
      .set('Authorization', `Basic ${credentials}`);

    expect(response.status).toBe(200);
    expect(response.body.user.username).toBe('testuser');
    expect(response.body.token).toBeDefined();
  });

  test.each([
    ['missing header', undefined],
    ['wrong scheme', 'Bearer abc123'],
    ['missing credentials', 'Basic'],
    ['extra header part', 'Basic abc123 extra'],
    ['invalid Base64', 'Basic !!!'],
    ['missing password separator', 'Basic dGVzdHVzZXI='],
  ])('POST /signin rejects %s', async (description, authorization) => {
    const testRequest = request(app).post('/signin');

    if (authorization !== undefined) {
      testRequest.set('Authorization', authorization);
    }

    const response = await testRequest;

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Invalid login',
    });

    expect(users.findOne).not.toHaveBeenCalled();
  });

});
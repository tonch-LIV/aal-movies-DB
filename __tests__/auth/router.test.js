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
      error: 'Username and password are required',
    });

    expect(users.create).not.toHaveBeenCalled();
  });

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

});
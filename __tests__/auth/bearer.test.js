'use strict';

const jwt = require('jsonwebtoken');

jest.mock('../../src/models', () => ({
  users: {
    findByPk: jest.fn(),
  },
}));

const { users } = require('../../src/models');
const bearer = require('../../src/auth/bearer');

describe('Bearer Auth Middleware', () => {

  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.SECRET = 'test-secret';

    req = {
      headers: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

  });

  test('authenticates a user with a valid token', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      role: 'user',
    };

    users.findByPk.mockResolvedValue(mockUser);

    const token = jwt.sign(
      { id: mockUser.id },
      process.env.SECRET,
      { expiresIn: '15m' }
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(users.findByPk).toHaveBeenCalledWith(1);
    expect(req.user).toBe(mockUser);
    expect(next).toHaveBeenCalled();
  });

  test('rejects a request with no Bearer authorization header', async () => {
    await bearer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an invalid token', async () => {
    req.headers.authorization = 'Bearer not-a-valid-token';

    await bearer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a valid token when the user no longer exists', async () => {
    users.findByPk.mockResolvedValue(null);

    const token = jwt.sign(
      { id: 999 },
      process.env.SECRET,
      { expiresIn: '15m' }
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(users.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an expired token', async () => {
    const token = jwt.sign(
      { id: 1 },
      process.env.SECRET,
      { expiresIn: -10 }
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(users.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a token signed with the wrong secret', async () => {
    const token = jwt.sign(
      { id: 1 },
      'incorrect-secret',
      { expiresIn: '15m' }
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(users.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a token without an expiration claim', async () => {
    const token = jwt.sign(
      { id: 1 },
      process.env.SECRET
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(users.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a token with a lifetime longer than 15 minutes', async () => {
    const token = jwt.sign(
      { id: 1 },
      process.env.SECRET,
      { expiresIn: '1h' }
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(users.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    ['wrong scheme', 'Basic abc123'],
    ['missing token', 'Bearer'],
    ['extra header part', 'Bearer abc123 extra'],
    ['extra spaces', 'Bearer  abc123'],
  ])('rejects a malformed Bearer header: %s', async (description, authorization) => {
    req.headers.authorization = authorization;

    await bearer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(users.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    ['missing ID', {}],
    ['string ID', { id: '1' }],
    ['zero ID', { id: 0 }],
    ['negative ID', { id: -1 }],
    ['decimal ID', { id: 1.5 }],
  ])('rejects a token with %s', async (description, payload) => {
    const token = jwt.sign(
      payload,
      process.env.SECRET,
      { expiresIn: '15m' }
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid token',
    });
    expect(users.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('uses the database role instead of the JWT role', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      role: 'user',
    };

    users.findByPk.mockResolvedValue(mockUser);

    const token = jwt.sign(
      { id: 1, role: 'admin' },
      process.env.SECRET,
      { expiresIn: '15m' }
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(users.findByPk).toHaveBeenCalledWith(1);
    expect(req.user).toBe(mockUser);
    expect(req.user.role).toBe('user');
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('forwards database failures instead of returning 401', async () => {
    const error = new Error('Database unavailable');
    users.findByPk.mockRejectedValueOnce(error);

    const token = jwt.sign(
      { id: 1 },
      process.env.SECRET,
      { expiresIn: '15m' }
    );

    req.headers.authorization = `Bearer ${token}`;

    await bearer(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });

});
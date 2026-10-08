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

});
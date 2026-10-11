'use strict';

const bcrypt = require('bcrypt');

jest.mock('../../src/models', () => ({
  users: {
    findOne: jest.fn(),
  },
}));

const { users } = require('../../src/models');
const basic = require('../../src/auth/basic');

describe('Basic Auth Middleware', () => {

  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      headers: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  test('authenticates a user with valid credentials', async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);

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

    req.headers.authorization = `Basic ${credentials}`;

    await basic(req, res, next);

    expect(users.findOne).toHaveBeenCalledWith({
      where: { username: 'testuser' },
    });

    expect(req.user).toBe(mockUser);
    expect(next).toHaveBeenCalled();
  });

  test('rejects a request with no Basic authorization header', async () => {
    await basic(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid login',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects a username that does not exist', async () => {
    users.findOne.mockResolvedValue(null);

    const credentials = Buffer
      .from('unknownuser:password123')
      .toString('base64');

    req.headers.authorization = `Basic ${credentials}`;

    await basic(req, res, next);

    expect(users.findOne).toHaveBeenCalledWith({
      where: { username: 'unknownuser' },
    });

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid login',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an incorrect password', async () => {
    const hashedPassword = await bcrypt.hash('correctpassword', 10);

    const mockUser = {
      id: 1,
      username: 'testuser',
      password: hashedPassword,
      role: 'user',
    };

    users.findOne.mockResolvedValue(mockUser);

    const credentials = Buffer
      .from('testuser:wrongpassword')
      .toString('base64');

    req.headers.authorization = `Basic ${credentials}`;

    await basic(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid login',
    });
    expect(req.user).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

});
'use strict';

const permit = require('../../src/auth/permissions');

describe('Permissions Middleware', () => {

  let res;
  let next;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  test('allows a user with the required capability', () => {
    const req = {
      user: {
        role: 'user',
      },
    };

    const middleware = permit('create');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('allows an admin with the required capability', () => {
    const req = {
      user: {
        role: 'admin',
      },
    };

    const middleware = permit('delete');

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('denies an unknown role', () => {
    const req = {
      user: {
        role: 'unknown',
      },
    };

    const middleware = permit('read');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('denies a capability that is not allowed', () => {
    const req = {
      user: {
        role: 'user',
      },
    };

    const middleware = permit('manage-users');

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
    });
    expect(next).not.toHaveBeenCalled();
  });

});
'use strict';

const bcrypt = require('bcrypt');
const { db, users: User } = require('../../src/models');

describe('User Model', () => {

  beforeAll(async () => {
    await db.sync();
  });

  afterAll(async () => {
    await db.close();
  });

  test('creates a user with the default role of user', async () => {
    const user = await User.create({
      username: 'testuser',
      password: 'password123',
    });

    expect(user.username).toBe('testuser');
    expect(user.role).toBe('user');
  });

  test('hashes the user password before saving', async () => {
    const user = await User.create({
      username: 'hashuser',
      password: 'password123',
    });

    expect(user.password).not.toBe('password123');

    const validPassword = await bcrypt.compare(
      'password123',
      user.password
    );

    expect(validPassword).toBe(true);
  });

  test('does not allow duplicate usernames', async () => {
    await User.create({
      username: 'uniqueuser',
      password: 'password123',
    });

    await expect(
      User.create({
        username: 'uniqueuser',
        password: 'differentpassword',
      })
    ).rejects.toThrow();
  });

  test('can create an admin user when role is explicitly provided', async () => {
    const admin = await User.create({
      username: 'adminuser',
      password: 'adminpassword',
      role: 'admin',
    });

    expect(admin.role).toBe('admin');
  });

});
'use strict';

const bcrypt = require('bcrypt');
const { users } = require('../models');

async function basic(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Basic ')) {
      return res.status(401).json({
        error: 'Invalid login',
      });
    }

    const encodedCredentials = authorization.split(' ')[1];
    const decodedCredentials = Buffer
      .from(encodedCredentials, 'base64')
      .toString();

    const [username, password] = decodedCredentials.split(':');

    if (!username || !password) {
      return res.status(401).json({
        error: 'Invalid login',
      });
    }

    const user = await users.findOne({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid login',
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({
        error: 'Invalid login',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = basic;
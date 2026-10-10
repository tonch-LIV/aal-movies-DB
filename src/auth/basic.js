'use strict';

const bcrypt = require('bcrypt');
const { users } = require('../models');

async function basic(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    const headerParts = authorization?.split(' ');

    if (
      headerParts?.length !== 2 ||
      headerParts[0] !== 'Basic' ||
      !headerParts[1]
    ) {
      return res.status(401).json({
        error: 'Invalid login',
      });
    }

    const encodedCredentials = headerParts[1];

    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        encodedCredentials
      )
    ) {
      return res.status(401).json({
        error: 'Invalid login',
      });
    }

    const decodedCredentials = Buffer
      .from(encodedCredentials, 'base64')
      .toString('utf8');

    const separatorIndex = decodedCredentials.indexOf(':');

    if (separatorIndex <= 0) {
      return res.status(401).json({
        error: 'Invalid login',
      });
    }

    const username = decodedCredentials.slice(0, separatorIndex);
    const password = decodedCredentials.slice(separatorIndex + 1);

    if (!password) {
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
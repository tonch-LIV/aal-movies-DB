'use strict';

const jwt = require('jsonwebtoken');
const { users } = require('../models');

async function bearer(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Invalid token',
      });
    }

    const token = authorization.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'Invalid token',
      });
    }

    const decoded = jwt.verify(token, process.env.SECRET);

    const user = await users.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'Invalid token',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Invalid token',
    });
  }
}

module.exports = bearer;
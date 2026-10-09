'use strict';

const jwt = require('jsonwebtoken');
const { users } = require('../models');

async function bearer(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    const headerParts = authorization?.split(' ');

    if (
      headerParts?.length !== 2 ||
      headerParts[0] !== 'Bearer' ||
      !headerParts[1]
    ) {
      return res.status(401).json({
        error: 'Invalid token',
      });
    }

    const token = headerParts[1];

    const decoded = jwt.verify(token, process.env.SECRET, {
      algorithms: ['HS256'],
    });

    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !Number.isSafeInteger(decoded.id) ||
      decoded.id <= 0 ||
      !Number.isInteger(decoded.iat) ||
      !Number.isInteger(decoded.exp) ||
      decoded.exp <= decoded.iat ||
      decoded.exp - decoded.iat > 900
    ) {
      return res.status(401).json({
        error: 'Invalid token',
      });
    }

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
'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const { users } = require('../models');
const basic = require('./basic');

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { id: user.id },
    process.env.SECRET,
    { expiresIn: '15m' }
  );
}

function safeUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
}

router.post('/signup', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
      });
    }

    const user = await users.create({
      username,
      password,
      role: 'user',
    });

    const token = createToken(user);

    return res.status(201).json({
      user: safeUser(user),
      token,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'Username already exists',
      });
    }

    return next(error);
  }
});

router.post('/signin', basic, (req, res) => {
  const token = createToken(req.user);

  return res.status(200).json({
    user: safeUser(req.user),
    token,
  });
});

module.exports = router;
'use strict';

const { Sequelize } = require('sequelize');

const isTest = process.env.NODE_ENV === 'test';

if (!isTest && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const db = isTest
  ? new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    })
  : new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
    });

// Register supplied factories and central associations here.

module.exports = { 
  db,
 // users,
 // movies,
 // favorites,
};
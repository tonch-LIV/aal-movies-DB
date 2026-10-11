'use strict';

const { Sequelize, DataTypes } = require('sequelize');
const userModel = require('../auth/user-model.js');
const movieModel = require('../movies/movie-model.js');
const favoriteModel = require('../favorites/favorite-model.js');

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

const users = userModel(db, DataTypes);
const movies = movieModel(db, DataTypes);
const favorites = favoriteModel(db, DataTypes);

users.hasMany(movies, {
  as: 'movies',
  foreignKey: 'ownerId',
  onDelete: 'RESTRICT',
});

movies.belongsTo(users, {
  as: 'owner',
  foreignKey: 'ownerId',
  onDelete: 'RESTRICT',
});

users.hasMany(favorites, {
  as: 'favorites',
  foreignKey: 'userId',
  onDelete: 'RESTRICT',
});

favorites.belongsTo(users, {
  as: 'user',
  foreignKey: 'userId',
  onDelete: 'RESTRICT',
});

movies.hasMany(favorites, {
  as: 'favorites',
  foreignKey: 'movieId',
  onDelete: 'CASCADE',
});

favorites.belongsTo(movies, {
  as: 'movie',
  foreignKey: 'movieId',
  onDelete: 'CASCADE',
});

module.exports = { 
  db,
 users,
 movies,
 favorites,
};
'use strict';

const { Sequelize, DataTypes } = require('sequelize');
const movieModel = require('../../src/movies/movie-model');

// Isolated SQLite memory database: never imports the shared registry or dotenv.
let db, movies;
beforeAll(async () => {
  db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  movies = movieModel(db, DataTypes);
  await db.sync();
});
beforeEach(async () => { await movies.destroy({ where: {} }); });
afterAll(async () => { if (db) await db.close(); });
const entry = { ownerId: 1, tmdbId: 550, title: 'Movie' };

test('defaults to planned and permits absent optional metadata and notes', async () => {
  const movie = await movies.create(entry);
  const stored = await movies.findByPk(movie.id);
  expect(stored.status).toBe('planned');
  expect(stored.overview).toBeNull();
  expect(stored.releaseDate).toBeNull();
  expect(stored.posterPath).toBeNull();
  expect(stored.notes).toBeNull();
});
test('stores watched status, notes, and a null release date', async () => {
  const movie = await movies.create({ ...entry, status: 'watched', notes: 'My notes', releaseDate: null });
  const stored = await movies.findByPk(movie.id);
  expect(stored.status).toBe('watched');
  expect(stored.notes).toBe('My notes');
  expect(stored.releaseDate).toBeNull();
});
test('rejects duplicate TMDB submissions by the same owner', async () => {
  await movies.create(entry);
  await expect(movies.create(entry)).rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });
  expect(await movies.count()).toBe(1);
});
test('allows different owners to submit the same film and one owner to submit different films', async () => {
  await movies.create(entry);
  await movies.create({ ...entry, ownerId: 2 });
  await movies.create({ ...entry, tmdbId: 551 });
  expect(await movies.count()).toBe(3);
});
test.each(['ownerId', 'tmdbId', 'title'])('requires %s', async (field) => {
  await expect(movies.create({ ...entry, [field]: null })).rejects.toMatchObject({ name: 'SequelizeValidationError' });
});

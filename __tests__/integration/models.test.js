'use strict';

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError,
} = require('sequelize');

const { db, users, movies, favorites } = require('../../src/models');

let userA;
let userB;
let movieA;

beforeEach(async () => {
  if (db.getDialect() !== 'sqlite' || db.options.storage !== ':memory:') {
    throw new Error('These test require in in-memory SQLite');
  }

  await db.sync({ force: true });

  userA = await users.create({
    username: 'user-a',
    password: 'test-password-a',
  });

  userB = await users.create({
    username: 'user-b',
    password: 'test-password-b;,'
  });

  movieA = await movies.create({
    ownerId: userA.id,
    tmdbId: 550,
    title: 'Test movie',
  });
});

afterAll(async () => {
  await db.close();
});

test('an entry defaults to planned and another user can submit the same film', async () => {
  expect(movieA.status).toBe('planned');

  const movieB = await movies.create({
    ownerId: userB.id,
    tmdbId: movieA.tmdbId,
    title: 'Test movie',
  });

  expect(movieB.id).not.toBe(movieA.id);
  expect(movieB.ownerId).toBe(userB.id);
});

test('one owner cannot submit the same TMDB film twice', async () => {
  await expect(movies.create({
    ownerId: userA.id,
    tmdbId: movieA.tmdbId,
    title: 'Duplicate',
  })).rejects.toBeInstanceOf(UniqueConstraintError);
});

test('different users can favorite an entry, but duplicate favorites fail', async () => {
  await favorites.create({
    userId: userA.id,
    movieId: movieA.id,
  });

  const favoriteB = await favorites.create({
    userId: userB.id,
    movieId: movieA.id,
  });

  await expect(favorites.create({
    userId: userB.id,
    movieId: movieA.id,
  })).rejects.toBeInstanceOf(UniqueConstraintError);

  const relatedMovie = await favoriteB.getMovie();
  const owner = await relatedMovie.getOwner();

  expect(owner.id).toBe(userA.id);
  expect(await movies.count()).toBe(1);
});

test('foreign keys reject nonexistent records', async () => {
  await expect(movies.create({
    ownerId: 999999,
    tmdbId: 551,
    title: 'Invalid owner',
  })).rejects.toBeInstanceOf(ForeignKeyConstraintError);

  await expect(favorites.create({
    userId: 999999,
    movieId: movieA.id,
  })).rejects.toBeInstanceOf(ForeignKeyConstraintError);

  await expect(favorites.create({
    userId: userB.id,
    movieId: 999999,
  })).rejects.toBeInstanceOf(ForeignKeyConstraintError);
});

test('favorite references cannot be null', async () => {
  await expect(favorites.create({
    userId: null,
    movieId: movieA.id,
  })).rejects.toBeInstanceOf(ValidationError);

  await expect(favorites.create({
    userId: userB.id,
    movieId: null,
  })).rejects.toBeInstanceOf(ValidationError);
});

test('deleting a movie removes all its favorites but preserves unrelated favorites', async () => {
  const movieB = await movies.create({
    ownerId: userB.id,
    tmdbId: 551,
    title: 'Another movie',
  });

  await favorites.bulkCreate([
    { userId: userA.id, movieId: movieA.id },
    { userId: userB.id, movieId: movieA.id },
    { userId: userA.id, movieId: movieB.id },
  ]);

  await movieA.destroy();

  expect(await favorites.count({
    where: { movieId: movieA.id },
  })).toBe(0);

  expect(await favorites.count({
    where: { movieId: movieB.id },
  })).toBe(1);

  expect(await users.count()).toBe(2);
});

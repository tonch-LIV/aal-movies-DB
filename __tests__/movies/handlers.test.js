'use strict';

jest.mock('../../src/models', () => ({ movies: {
  findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn(),
} }));
jest.mock('../../src/services/tmdb', () => ({ searchMovies: jest.fn(), getMovieDetails: jest.fn() }));
const { movies } = require('../../src/models');
const tmdb = require('../../src/services/tmdb');
const handlers = require('../../src/movies/handlers');
let req, res, next, movie;
const details = { tmdbId: 550, title: 'Movie', overview: 'Overview', releaseDate: '2020-01-01', posterPath: null };
beforeEach(() => {
  jest.resetAllMocks();
  req = { query: {}, params: { id: '1' }, body: { tmdbId: 550 }, user: { id: 2, role: 'user' } };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() };
  next = jest.fn();
  movie = { id: 1, ownerId: 2, update: jest.fn(), destroy: jest.fn() };
  movies.findByPk.mockResolvedValue(movie);
  movies.findOne.mockResolvedValue(null);
  tmdb.getMovieDetails.mockResolvedValue(details);
  movies.create.mockResolvedValue(movie);
});
const expectError = (status, message) => {
  expect(res.status).toHaveBeenCalledWith(status);
  expect(res.json).toHaveBeenCalledWith({ error: message });
  expect(next).not.toHaveBeenCalled();
};

test('exports all six handlers', () => {
  expect(Object.keys(handlers).sort()).toEqual(['create', 'getAll', 'getOne', 'remove', 'search', 'update']);
});
test('search returns normalized TMDB results publicly', async () => {
  delete req.user;
  req.query.q = 'movie';
  tmdb.searchMovies.mockResolvedValue([details]);
  await handlers.search(req, res, next);
  expect(tmdb.searchMovies).toHaveBeenCalledWith('movie');
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith([details]);
});
test.each([undefined, '', '  ', [], {}])('search rejects invalid query %p', async (q) => {
  req.query.q = q;
  await handlers.search(req, res, next);
  expectError(400, 'Search query is required');
  expect(tmdb.searchMovies).not.toHaveBeenCalled();
});
test.each(['search', 'create'])('%s returns safe TMDB failures', async (name) => {
  req.query.q = 'movie';
  const dependency = name === 'search' ? tmdb.searchMovies : tmdb.getMovieDetails;
  dependency.mockRejectedValue(new Error('private provider information'));
  await handlers[name](req, res, next);
  expectError(502, 'Unable to retrieve movies from TMDB');
  expect(movies.create).not.toHaveBeenCalled();
});
describe.each(['search', 'create'])('%s timeouts', (name) => {
  test.each([{ code: 'ECONNABORTED' }, { code: 'ETIMEDOUT' }, { response: { status: 504 } }])('returns 504 for %p', async (error) => {
    req.query.q = 'movie';
    (name === 'search' ? tmdb.searchMovies : tmdb.getMovieDetails).mockRejectedValue(error);
    await handlers[name](req, res, next);
    expectError(504, 'TMDB request timed out');
  });
});
test.each([undefined, '2'])('lists stored entries with optional owner filter %p', async (ownerId) => {
  req.query.ownerId = ownerId;
  movies.findAll.mockResolvedValue([movie]);
  await handlers.getAll(req, res, next);
  expect(movies.findAll).toHaveBeenCalledWith({ where: ownerId ? { ownerId: 2 } : {} });
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith([movie]);
  expect(tmdb.getMovieDetails).not.toHaveBeenCalled();
});
describe.each(['getOne', 'update', 'remove', 'getAll'])('%s ID validation', (name) => {
  test.each(['0', '-1', '1.5', 'abc', '1e2', '9007199254740992', ['1']])('rejects %p', async (id) => {
    req.params.id = id;
    req.query.ownerId = id;
    req.body = { status: 'watched' };
    await handlers[name](req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(movies.findByPk).not.toHaveBeenCalled();
    expect(movies.findAll).not.toHaveBeenCalled();
  });
});
test('getOne returns a public stored entry without TMDB', async () => {
  delete req.user;
  await handlers.getOne(req, res, next);
  expect(movies.findByPk).toHaveBeenCalledWith(1);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith(movie);
  expect(tmdb.getMovieDetails).not.toHaveBeenCalled();
});
test.each(['getOne', 'update', 'remove'])('%s returns 404 for a missing entry', async (name) => {
  req.body = { status: 'watched' };
  movies.findByPk.mockResolvedValue(null);
  await handlers[name](req, res, next);
  expectError(404, 'Movie not found');
});
describe.each(['create', 'update', 'remove'])('%s authentication', (name) => {
  test('rejects missing authentication', async () => {
    delete req.user;
    await handlers[name](req, res, next);
    expectError(401, 'Authentication required');
    expect(movies.findByPk).not.toHaveBeenCalled();
    expect(movies.create).not.toHaveBeenCalled();
  });
  test('denies an unknown role', async () => {
    req.user.role = 'unknown';
    await handlers[name](req, res, next);
    expectError(403, 'Access denied');
  });
});
describe.each(['create', 'update'])('%s body validation', (name) => {
  test.each([null, undefined, [], 'text', { status: 'invalid' }, { status: null }, { notes: 42 }, { notes: {} }])('rejects %p', async (body) => {
    req.body = body;
    await handlers[name](req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(movies.create).not.toHaveBeenCalled();
    expect(movie.update).not.toHaveBeenCalled();
    expect(tmdb.getMovieDetails).not.toHaveBeenCalled();
  });
});
test.each([undefined, 0, -1, 1.5, '550', {}, Number.MAX_SAFE_INTEGER + 1])('create rejects invalid TMDB ID %p', async (tmdbId) => {
  req.body.tmdbId = tmdbId;
  await handlers.create(req, res, next);
  expectError(400, 'Valid TMDB movie ID is required');
  expect(tmdb.getMovieDetails).not.toHaveBeenCalled();
});
test('create uses provider metadata and authenticated ownership, ignoring client overrides', async () => {
  req.body = { tmdbId: 550, ownerId: 999, title: 'Forged', status: 'watched', notes: 'My notes' };
  await handlers.create(req, res, next);
  expect(movies.findOne).toHaveBeenCalledWith({ where: { ownerId: 2, tmdbId: 550 } });
  expect(movies.create).toHaveBeenCalledWith({ ...details, ownerId: 2, status: 'watched', notes: 'My notes' });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(movie);
});
test('create leaves optional fields to model defaults', async () => {
  await handlers.create(req, res, next);
  expect(movies.create).toHaveBeenCalledWith({ ...details, ownerId: 2 });
});
test('existing owner/movie duplicate returns 409 before TMDB', async () => {
  movies.findOne.mockResolvedValue(movie);
  await handlers.create(req, res, next);
  expectError(409, 'Movie already exists in your list');
  expect(tmdb.getMovieDetails).not.toHaveBeenCalled();
});
test('database uniqueness conflict returns 409 for simultaneous submissions', async () => {
  movies.create.mockRejectedValue({ name: 'SequelizeUniqueConstraintError' });
  await handlers.create(req, res, next);
  expectError(409, 'Movie already exists in your list');
});
describe.each(['update', 'remove'])('%s ownership', (name) => {
  test.each([{ id: 2, role: 'user' }, { id: '2', role: 'user' }, { id: 3, role: 'admin' }])('allows owner or admin %p', async (user) => {
    req.user = user;
    req.body = { status: 'watched', notes: null, ownerId: 999, tmdbId: 999, title: 'Forged' };
    await handlers[name](req, res, next);
    if (name === 'update') {
      expect(movie.update).toHaveBeenCalledWith({ status: 'watched', notes: null });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(movie);
    } else {
      expect(movie.destroy).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalledWith();
      expect(res.json).not.toHaveBeenCalled();
    }
    expect(tmdb.getMovieDetails).not.toHaveBeenCalled();
  });
  test('denies another user even if they have favorited the entry', async () => {
    req.user = { id: 3, role: 'user', favorites: [{ movieId: 1 }] };
    req.body = { notes: 'Changed' };
    await handlers[name](req, res, next);
    expectError(403, 'Access denied');
    expect(movie.update).not.toHaveBeenCalled();
    expect(movie.destroy).not.toHaveBeenCalled();
  });
});
test.each([{}, { ownerId: 3 }, { tmdbId: 42 }])('update requires an editable field %p', async (body) => {
  req.body = body;
  await handlers.update(req, res, next);
  expectError(400, 'Provide status or notes to update');
  expect(movie.update).not.toHaveBeenCalled();
});
test.each(['getAll', 'getOne', 'create', 'update', 'remove'])('%s forwards unexpected database errors', async (name) => {
  const error = new Error('Database unavailable');
  req.body = { tmdbId: 550, notes: '' };
  movies.findAll.mockRejectedValue(error);
  movies.findByPk.mockRejectedValue(error);
  movies.findOne.mockRejectedValue(error);
  await handlers[name](req, res, next);
  expect(next).toHaveBeenCalledWith(error);
  expect(res.json).not.toHaveBeenCalled();
});

describe.each(['update', 'remove'])('%s two users and one admin', (name) => {
  test.each([
    [2, 2, 'user', 200], [3, 3, 'user', 200],
    [2, 3, 'user', 403], [3, 2, 'user', 403],
    [2, 4, 'admin', 200], [3, 4, 'admin', 200],
  ])('owner %i, requester %i (%s) yields %i', async (ownerId, id, role, status) => {
    movie.ownerId = ownerId;
    req.user = { id, role };
    req.body = { notes: 'Updated', ownerId: 999 };
    await handlers[name](req, res, next);
    expect(res.status).toHaveBeenCalledWith(status === 200 && name === 'remove' ? 204 : status);
    if (status === 403) {
      expect(movie.update).not.toHaveBeenCalled();
      expect(movie.destroy).not.toHaveBeenCalled();
    } else if (name === 'update') {
      expect(movie.update).toHaveBeenCalledWith({ notes: 'Updated' });
    } else {
      expect(movie.destroy).toHaveBeenCalledTimes(1);
    }
    expect(movie.ownerId).toBe(ownerId);
  });
});

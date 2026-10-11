'use strict';

const { movies } = require('../models');
const { searchMovies, getMovieDetails } = require('../services/tmdb');

const publicOwnerInclude = [{
  association: 'owner',
  attributes: ['id', 'username'],
  paranoid: false,
  required: false,
}];

// Route/query IDs arrive as strings; JSON body IDs must be numbers.
const parseId = (value) => {
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const validateBody = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'A JSON object is required';
  }
  if (body.status !== undefined && !['planned', 'watched'].includes(body.status)) {
    return 'Status must be planned or watched';
  }
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    return 'Notes must be a string or null';
  }
  return null;
};

const authorize = (req, res) => {
  if (!req.user || parseId(req.user.id) === null) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  if (!['user', 'admin'].includes(req.user.role)) {
    res.status(403).json({ error: 'Access denied' });
    return false;
  }
  return true;
};

const canModify = (movie, user) => (
  user.role === 'admin' || parseId(movie.ownerId) === parseId(user.id)
);

const providerError = (res, error) => {
  const timedOut = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
    || error.response?.status === 408 || error.response?.status === 504;
  return res.status(timedOut ? 504 : 502).json({
    error: timedOut ? 'TMDB request timed out' : 'Unable to retrieve movies from TMDB',
  });
};

const search = async (req, res, next) => {
  if (typeof req.query.q !== 'string' || !req.query.q.trim()) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  try {
    const results = await searchMovies(req.query.q);
    return res.status(200).json(results);
  } catch (error) {
    return providerError(res, error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const where = {};

    if (req.query.ownerId !== undefined) {
      where.ownerId = parseId(req.query.ownerId);
      if (where.ownerId === null) {
        return res.status(400).json({ error: 'Valid owner ID is required' });
      }
    }

    const results = await movies.findAll({
      where,
      include: publicOwnerInclude,
    });
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
};

const getOne = async (req, res, next) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Valid movie ID is required' });
  try {
    const movie = await movies.findByPk(id, {
      include: publicOwnerInclude,
    });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    return res.status(200).json(movie);
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  if (!authorize(req, res)) return;
  const validationError = validateBody(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  try {
    const { tmdbId, status, notes } = req.body;

    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return res.status(400).json({ error: 'Valid TMDB movie ID is required' });
    }

    const ownerId = parseId(req.user.id);
    const existing = await movies.findOne({ where: { ownerId, tmdbId } });
    if (existing) {
      return res.status(409).json({ error: 'Movie already exists in your list' });
    }

    let details;
    try {
      details = await getMovieDetails(tmdbId);
    } catch (error) {
      return providerError(res, error);
    }

    const movie = await movies.create({
      ...details,
      ownerId,
      ...(status !== undefined ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
    });

    return res.status(201).json(movie);
  } catch (error) {
    // The unique database index also protects simultaneous submissions.
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Movie already exists in your list' });
    }
    next(error);
  }
};

const update = async (req, res, next) => {
  if (!authorize(req, res)) return;
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Valid movie ID is required' });
  const validationError = validateBody(req.body);
  if (validationError) return res.status(400).json({ error: validationError });

  const changes = {};
  if (req.body.status !== undefined) changes.status = req.body.status;
  if (req.body.notes !== undefined) changes.notes = req.body.notes;
  if (Object.keys(changes).length === 0) {
    return res.status(400).json({ error: 'Provide status or notes to update' });
  }

  try {
    const movie = await movies.findByPk(id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    if (!canModify(movie, req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await movie.update(changes);
    return res.status(200).json(movie);
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  if (!authorize(req, res)) return;
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Valid movie ID is required' });
  try {
    const movie = await movies.findByPk(id);

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    if (!canModify(movie, req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await movie.destroy();

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = { search, getAll, getOne, create, update, remove };

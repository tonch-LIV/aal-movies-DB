'use strict';

const { movies, favorites } = require('../models');

function parseId(value) {
  if (typeof value === 'string' && !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function getAll(req, res, next) {
  try {
    let userId = req.user.id;

    if (req.query.userId !== undefined) {
      const requestedId = parseId(req.query.userId);

      if (requestedId === null) {
        return res.status(400).json({ error: 'Valid user ID is required' });
      }

      if (req.user.role !== 'admin' && requestedId !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      userId = requestedId;
    }

    const records = await favorites.findAll({
      where: { userId },
    });

    return res.status(200).json(records);
  } catch (error) {
    return next(error);
  }
}

async function create(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'A JSON object is required' });
  }

  // JSON body IDs must be numbers.
  if (!Number.isSafeInteger(body.movieId) || body.movieId <= 0) {
    return res.status(400).json({ error: 'Valid movie ID is required' });
  }

  try {
    const movie = await movies.findByPk(body.movieId);

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    const favorite = await favorites.create({
      userId: req.user.id,
      movieId: movie.id,
    });

    return res.status(201).json(favorite);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ error: 'Movie already favorited' });
    }

    // The entry may have been deleted after the existence check.
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(404).json({ error: 'Referenced resource no longer exists' });
    }

    return next(error);
  }
}

async function remove(req, res, next) {
  const id = parseId(req.params.id);

  if (id === null) {
    return res.status(400).json({ error: 'Valid favorite ID is required' });
  }

  try {
    const favorite = await favorites.findByPk(id);

    if (!favorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    if (req.user.role !== 'admin' && favorite.userId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await favorite.destroy();
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = { getAll, create, remove };
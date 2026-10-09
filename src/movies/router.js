'use strict';

const express = require('express');
const router = express.Router();

const handlers = require('./handlers');
const bearer = require('../auth/bearer');
const permit = require('../auth/permissions');

// Public movie routes
router.get('/search', handlers.search);
router.get('/', handlers.getAll);
router.get('/:id', handlers.getOne);

// Protected movie routes
router.post('/', bearer, permit('create'), handlers.create);
router.put('/:id', bearer, permit('update'), handlers.update);
router.delete('/:id', bearer, permit('delete'), handlers.remove);

module.exports = router;

'use strict';

const express = require('express');
const bearer = require('../auth/bearer');
const permit = require('../auth/permissions'); // checks role authoriz; denies unknown roles
const handlers = require('./handlers');

const router = express.Router();

router.get('/', bearer, permit('read'), handlers.getAll);
router.post('/', bearer, permit('create'), handlers.create);
router.delete('/:id', bearer, permit('delete'), handlers.remove);

module.exports = router;
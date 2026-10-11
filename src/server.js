'use strict';

const express = require('express');
const cors = require('cors');

const notFound = require('./error-handlers/404');
const errorHandler = require('./error-handlers/500');

const authRouter = require('./auth/router');
const moviesRouter = require('./movies/router');
const favoritesRouter = require('./favorites/router');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// supplied routers Mount.

app.use('/', authRouter);
app.use('/movies', moviesRouter);
app.use('/favorites', favoritesRouter);

app.use(notFound);
app.use(errorHandler);

function start(port = process.env.PORT || 3000) {
  return app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = { app, start };
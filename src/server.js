'use strict';

const express = require('express');
const cors = require('cors');
const notFound = require('./error-handlers/404');
const errorHandler = require('./error-handlers/500');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Mount supplied routers here when their modules are ready.

app.use(notFound);
app.use(errorHandler);

function start(port = process.env.PORT || 3000) {
  return app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = { app, start };
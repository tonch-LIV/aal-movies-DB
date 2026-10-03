'use strict';

require('dotenv').config();

const { db } = require('./src/models');
const { start } = require('./src/server');

async function boot() {
  try {
    await db.authenticate();
    start();
  } catch (err) {
    console.error('Server startup failed', {
      name: err.name,
      code: err.original?.code || err.code,
    });
    await db.close();
    process.exitCode = 1;
  }
}

boot();
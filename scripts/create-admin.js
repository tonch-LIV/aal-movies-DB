'use strict';

require('dotenv').config();

const { db, users } = require('../src/models');

async function createAdmin() {
  const [username, password] = process.argv.slice(2);

  if (!username || !password) {
    console.error(
      'Usage: node scripts/create-admin.js <username> <password>'
    );
    process.exitCode = 1;
    return;
  }

  try {
    await db.authenticate();

    const admin = await users.create({
      username,
      password,
      role: 'admin',
    });

    console.log(`Admin user "${admin.username}" created.`);
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('Username already exists.');
    } else {
      console.error('Failed to create admin user.');
    }

    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

createAdmin();
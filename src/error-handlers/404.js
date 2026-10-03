'use strict';

module.exports = (req, res) => {
  res.status(404).json({ error: 'Resource not found' });
};
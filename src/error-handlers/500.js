'use strict';

module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  return res.status(500).json({ error: 'Internal server error' });
};
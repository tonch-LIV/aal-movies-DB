'use strict';

const capabilities = {
  user: ['read', 'create', 'update', 'delete'],
  admin: ['read', 'create', 'update', 'delete'],
};

function permit(capability) {
  return (req, res, next) => {
    const role = req.user && req.user.role;
    const allowed = capabilities[role];

    if (!allowed || !allowed.includes(capability)) {
      return res.status(403).json({
        error: 'Forbidden',
      });
    }

    next();
  };
}

module.exports = permit;
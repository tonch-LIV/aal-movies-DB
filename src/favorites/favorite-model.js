'use strict';

const favoriteModel = (sequelize, DataTypes) => {
  return sequelize.define('Favorite', {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    movieId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['userId', 'movieId'],
      },
    ],
  });
};

module.exports = favoriteModel;
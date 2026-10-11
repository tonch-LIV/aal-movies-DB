'use strict';

const movieModel = (sequelize, DataTypes) => {
  const Movie = sequelize.define('Movie', {
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tmdbId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    overview: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    releaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    posterPath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('planned', 'watched'),
      allowNull: false,
      defaultValue: 'planned',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    indexes: [
      {
        unique: true,
        fields: ['ownerId', 'tmdbId'],
      },
    ],
  });

  return Movie;
};

module.exports = movieModel;

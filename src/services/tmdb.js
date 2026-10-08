'use strict';

const axios = require('axios');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const getHeaders = () => ({
  Authorization: `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
  accept: 'application/json',
});

const normalizeMovie = (movie) => ({
  tmdbId: movie.id,
  title: movie.title,
  overview: movie.overview,
  releaseDate: movie.release_date,
  posterPath: movie.poster_path,
}); 

const searchMovies = async (query) => {
  if (!query || !query.trim()) {
    throw new Error('Search query is required');
  }

  const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
    headers: getHeaders(),
    params: {
      query: query.trim(),
    },
    timeout: 5000,
  });

  return response.data.results.map(normalizeMovie);
};

const getMovieDetails = async (tmdbId) => {
  if (!tmdbId) {
    throw new Error('TMDB movie ID is required');
  }

  const response = await axios.get(`${TMDB_BASE_URL}/movie/${tmdbId}`, {
    headers: getHeaders(),
    timeout: 5000,
  });

  return normalizeMovie(response.data);
};

module.exports = {
  searchMovies,
  getMovieDetails,
};

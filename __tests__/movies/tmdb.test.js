'use strict';

jest.mock('axios');

const axios = require('axios');
const { searchMovies, getMovieDetails } = require('../../src/services/tmdb');

const originalToken = process.env.TMDB_READ_ACCESS_TOKEN;
const providerMovie = {
  id: 550,
  title: 'Fight Club',
  overview: 'A movie overview.',
  release_date: '1999-10-15',
  poster_path: '/poster.jpg',
  popularity: 100,
};
const normalizedMovie = {
  tmdbId: 550,
  title: 'Fight Club',
  overview: 'A movie overview.',
  releaseDate: '1999-10-15',
  posterPath: '/poster.jpg',
};
const requestOptions = {
  headers: {
    Authorization: 'Bearer test-tmdb-token',
    accept: 'application/json',
  },
  timeout: 5000,
};

beforeEach(() => {
  jest.resetAllMocks();
  process.env.TMDB_READ_ACCESS_TOKEN = 'test-tmdb-token';
});

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.TMDB_READ_ACCESS_TOKEN;
  } else {
    process.env.TMDB_READ_ACCESS_TOKEN = originalToken;
  }
});

describe('searchMovies', () => {
  test('normalizes every search result and omits extra provider fields', async () => {
    axios.get.mockResolvedValue({
      data: { results: [providerMovie, { ...providerMovie, id: 551, title: 'Another movie' }] },
    });

    await expect(searchMovies('movie')).resolves.toEqual([
      normalizedMovie,
      { ...normalizedMovie, tmdbId: 551, title: 'Another movie' },
    ]);
  });

  test('sends a trimmed query as a parameter with authentication and a timeout', async () => {
    axios.get.mockResolvedValue({ data: { results: [] } });

    await searchMovies('  Movies & mysteries?  ');

    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith('https://api.themoviedb.org/3/search/movie', {
      ...requestOptions,
      params: { query: 'Movies & mysteries?' },
    });
  });

  test('returns an empty array when no movies match', async () => {
    axios.get.mockResolvedValue({ data: { results: [] } });

    await expect(searchMovies('no matching movie')).resolves.toEqual([]);
  });

  test.each([undefined, null, '', '   ', '\t\n', 42, true, [], {}, ['movie']])(
    'rejects an empty query (%p) without requesting TMDB',
    async (query) => {
      await expect(searchMovies(query)).rejects.toThrow('Search query is required');
      expect(axios.get).not.toHaveBeenCalled();
    },
  );
});

describe('getMovieDetails', () => {
  test('normalizes movie details and sends an authenticated, bounded request', async () => {
    axios.get.mockResolvedValue({ data: providerMovie });

    await expect(getMovieDetails(550)).resolves.toEqual(normalizedMovie);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/movie/550',
      requestOptions,
    );
  });

  test('preserves nullable movie metadata', async () => {
    axios.get.mockResolvedValue({
      data: { ...providerMovie, overview: null, release_date: null, poster_path: null },
    });

    await expect(getMovieDetails(550)).resolves.toEqual({
      ...normalizedMovie,
      overview: null,
      releaseDate: null,
      posterPath: null,
    });
  });

  test.each([undefined, null, '', '550', 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, true, [], {}])(
    'rejects a missing movie ID (%p) without requesting TMDB',
    async (tmdbId) => {
      await expect(getMovieDetails(tmdbId)).rejects.toThrow('TMDB movie ID is required');
      expect(axios.get).not.toHaveBeenCalled();
    },
  );
});

test.each(['search', 'details'])('%s normalizes an empty release date to null', async (operation) => {
  const movie = { ...providerMovie, release_date: '' };
  axios.get.mockResolvedValue({ data: operation === 'search' ? { results: [movie] } : movie });
  const expected = { ...normalizedMovie, releaseDate: null };
  await expect(operation === 'search' ? searchMovies('movie') : getMovieDetails(550))
    .resolves.toEqual(operation === 'search' ? [expected] : expected);
});

describe.each([
  ['searchMovies', () => searchMovies('movie')],
  ['getMovieDetails', () => getMovieDetails(550)],
])('%s request failures', (name, requestMovie) => {
  test('propagates a TMDB HTTP failure', async () => {
    const error = Object.assign(new Error('Request failed with status code 503'), {
      response: { status: 503, data: { status_message: 'Service unavailable' } },
    });
    axios.get.mockRejectedValue(error);

    await expect(requestMovie()).rejects.toBe(error);
  });

  test('propagates a network failure', async () => {
    const error = Object.assign(new Error('Network unavailable'), { code: 'ENOTFOUND' });
    axios.get.mockRejectedValue(error);

    await expect(requestMovie()).rejects.toBe(error);
  });

  test('propagates an Axios timeout and configures a 5,000 ms limit', async () => {
    const error = Object.assign(new Error('timeout of 5000ms exceeded'), {
      code: 'ECONNABORTED',
    });
    axios.get.mockRejectedValue(error);

    await expect(requestMovie()).rejects.toBe(error);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1]).toEqual(expect.objectContaining({ timeout: 5000 }));
  });
});

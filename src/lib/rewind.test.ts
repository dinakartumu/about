import { describe, expect, it } from 'vitest';
import {
  fmtWatchDate,
  monthRanges,
  shapeRecentWatches,
  shapeTopList,
  shapeWatchingStats,
  starsFor,
  yearHeadline,
} from './rewind';
import listeningYear from './__fixtures__/listening-year.json';
import topAlbums from './__fixtures__/top-albums.json';
import topArtists from './__fixtures__/top-artists.json';
import topTracks from './__fixtures__/top-tracks.json';
import watchingRecent from './__fixtures__/watching-recent.json';
import watchingStats from './__fixtures__/watching-stats.json';

describe('monthRanges', () => {
  it('returns the all entry first, then elapsed months newest first', () => {
    const ranges = monthRanges(2026, new Date('2026-07-20T12:00:00Z'));
    expect(ranges).toHaveLength(8); // all + Jan..Jul
    expect(ranges[0].label).toBe('All months');
    expect(ranges[1].label).toBe('July');
    expect(ranges[7].label).toBe('January');
  });

  it('spans the full year in the all entry', () => {
    const [all] = monthRanges(2026, new Date('2026-07-20T12:00:00Z'));
    expect(all.from).toBe('2026-01-01T00:00:00.000Z');
    expect(all.to).toBe('2026-12-31T23:59:59.999Z');
  });

  it('bounds each month entry to its first and last UTC millisecond', () => {
    const ranges = monthRanges(2026, new Date('2026-07-20T12:00:00Z'));
    const july = ranges.find((r) => r.label === 'July')!;
    expect(july.from).toBe('2026-07-01T00:00:00.000Z');
    expect(july.to).toBe('2026-07-31T23:59:59.999Z');
  });

  it('handles leap-year February', () => {
    const ranges = monthRanges(2024, new Date('2026-07-20T12:00:00Z'));
    const feb = ranges.find((r) => r.label === 'February')!;
    expect(feb.to).toBe('2024-02-29T23:59:59.999Z');
  });

  it('includes all 12 months for a fully elapsed year', () => {
    const ranges = monthRanges(2024, new Date('2026-07-20T12:00:00Z'));
    expect(ranges).toHaveLength(13);
    expect(ranges[1].label).toBe('December');
  });

  it('uses the UTC month, not the local one', () => {
    // 00:30 UTC on Jul 1 is still June in every western-hemisphere zone.
    const ranges = monthRanges(2026, new Date('2026-07-01T00:30:00Z'));
    expect(ranges[1].label).toBe('July');
  });

  it('returns only January when the year has just started', () => {
    const ranges = monthRanges(2026, new Date('2026-01-01T05:00:00Z'));
    expect(ranges.map((r) => r.label)).toEqual(['All months', 'January']);
  });
});

describe('starsFor', () => {
  it('halves a 1-10 rating onto five stars', () => {
    expect(starsFor(8)).toBe('★★★★☆');
  });

  it('renders a perfect ten as five full stars', () => {
    expect(starsFor(10)).toBe('★★★★★');
  });

  it('renders odd ratings with a half glyph', () => {
    expect(starsFor(7)).toBe('★★★½☆');
    expect(starsFor(9)).toBe('★★★★½');
    expect(starsFor(1)).toBe('½☆☆☆☆');
  });

  it('returns an empty string for null', () => {
    expect(starsFor(null)).toBe('');
  });
});

describe('fmtWatchDate', () => {
  it('formats an ISO timestamp as a watch date', () => {
    expect(fmtWatchDate('2026-07-19T18:31:00.000Z')).toBe('Watched Jul 19, 2026');
  });

  it('uses the UTC date, not the local one', () => {
    expect(fmtWatchDate('2026-07-01T02:00:00.000Z')).toBe('Watched Jul 1, 2026');
  });
});

describe('shapeTopList', () => {
  it('shapes artist items to the rendered fields', () => {
    const artists = shapeTopList(topArtists);
    expect(artists).toHaveLength(3);
    expect(artists[0]).toEqual({
      rank: 1,
      name: 'A.R. Rahman',
      detail: '',
      playcount: 189,
      image: null,
      link: null,
    });
  });

  it('maps image cdn_url and dominant color when present', () => {
    const artists = shapeTopList(topArtists);
    const withImage = artists.find((a) => a.name === 'J Dilla')!;
    expect(withImage.image).toEqual({
      url: 'https://cdn.dinakartumu.com/cdn-cgi/image/width=300,height=300,fit=cover,format=auto,quality=85/listening/artists/145/original.jpg?v=1',
      dominantColor: '#a06e3c',
    });
  });

  it('carries the artist name as detail on tracks', () => {
    const tracks = shapeTopList(topTracks);
    expect(tracks[0].name).toBe('Sense and Change');
    expect(tracks[0].detail).toBe('Sebastian Plano');
    expect(tracks[0].playcount).toBe(41);
  });

  it('shapes track images too', () => {
    const tracks = shapeTopList(topTracks);
    const withImage = tracks.find((t) => t.rank === 4)!;
    expect(withImage.image?.dominantColor).toBe('#7f6a31');
    expect(withImage.image?.url).toContain('cdn.dinakartumu.com');
  });

  it('links to Apple Music when the API provides a URL', () => {
    const shaped = shapeTopList({
      data: [
        {
          rank: 1,
          name: 'Example',
          detail: '',
          playcount: 3,
          image: null,
          url: '',
          apple_music_url: 'https://music.apple.com/us/artist/example/123',
        },
      ],
    });
    expect(shaped[0].link).toBe('https://music.apple.com/us/artist/example/123');
  });

  it('falls back to the item url when apple_music_url is null', () => {
    const tracks = shapeTopList(topTracks);
    expect(tracks[0].link).toBe('https://www.last.fm/music/Sebastian+Plano/_/Sense+and+Change');
  });

  it('leaves items unlinked when apple_music_url is null and url is empty', () => {
    const shaped = shapeTopList({
      data: [
        {
          rank: 1,
          name: 'Example',
          detail: '',
          playcount: 3,
          image: null,
          url: '',
          apple_music_url: null,
        },
      ],
    });
    expect(shaped[0].link).toBeNull();
  });

  it('prefers apple_music_url when both urls are present', () => {
    const shaped = shapeTopList({
      data: [
        {
          rank: 1,
          name: 'Example',
          detail: '',
          playcount: 3,
          image: null,
          url: 'https://www.last.fm/music/Example',
          apple_music_url: 'https://music.apple.com/us/artist/example/123',
        },
      ],
    });
    expect(shaped[0].link).toBe('https://music.apple.com/us/artist/example/123');
  });

  it('returns an empty array for an empty response', () => {
    expect(shapeTopList(topAlbums)).toEqual([]);
  });

  it('falls back to a neutral dominant color when extraction has not run', () => {
    const shaped = shapeTopList({
      data: [
        {
          rank: 1,
          name: 'Unextracted',
          detail: '',
          playcount: 2,
          image: { cdn_url: 'https://cdn.dinakartumu.com/x.jpg', dominant_color: null },
          url: '',
          apple_music_url: null,
        },
      ],
    });
    expect(shaped[0].image).toEqual({
      url: 'https://cdn.dinakartumu.com/x.jpg',
      dominantColor: '#1a1a1a',
    });
  });
});

describe('shapeRecentWatches', () => {
  it('shapes watches to the rendered fields', () => {
    const watches = shapeRecentWatches(watchingRecent);
    expect(watches).toHaveLength(3);
    expect(watches[0]).toEqual({
      title: 'Maa Behen',
      year: 2026,
      image: null,
      stars: '★★½☆☆',
      rating: 2.5,
      watchedDate: 'Watched Jul 19, 2026',
      tmdbUrl: 'https://www.themoviedb.org/movie/1628448',
      rewatch: false,
    });
  });

  it('maps the poster cdn_url and dominant color when present', () => {
    const watches = shapeRecentWatches(watchingRecent);
    const strangeDays = watches.find((w) => w.title === 'Strange Days')!;
    expect(strangeDays.image).toEqual({
      url: 'https://cdn.dinakartumu.com/cdn-cgi/image/width=240,height=360,fit=cover,format=auto,quality=85/watching/movies/1839/original.jpg?v=1',
      dominantColor: '#000000',
    });
    expect(strangeDays.stars).toBe('★★★★☆');
    expect(strangeDays.watchedDate).toBe('Watched Jun 28, 2026');
  });

  it('renders no stars for an unrated watch', () => {
    const watches = shapeRecentWatches(watchingRecent);
    const unrated = watches.find((w) => w.title === 'Maternal Instinct')!;
    expect(unrated.stars).toBe('');
  });

  it('leaves tmdbUrl null when tmdb_id is missing', () => {
    const shaped = shapeRecentWatches({
      data: [
        {
          movie: { title: 'No Id', year: null, image: null, tmdb_id: null },
          watched_at: '2026-01-02T00:00:00.000Z',
          user_rating: null,
          rewatch: true,
        },
      ],
    });
    expect(shaped[0].tmdbUrl).toBeNull();
    expect(shaped[0].rewatch).toBe(true);
  });

  it('falls back to a neutral dominant color when extraction has not run', () => {
    const shaped = shapeRecentWatches({
      data: [
        {
          movie: {
            title: 'Fresh Poster',
            year: 2026,
            image: { cdn_url: 'https://cdn.dinakartumu.com/p.jpg', dominant_color: null },
            tmdb_id: 1,
          },
          watched_at: '2026-07-19T00:00:00.000Z',
          user_rating: null,
          rewatch: false,
        },
      ],
    });
    expect(shaped[0].image).toEqual({
      url: 'https://cdn.dinakartumu.com/p.jpg',
      dominantColor: '#1a1a1a',
    });
  });
});

describe('shapeWatchingStats', () => {
  it('reads the headline numbers from the stats payload', () => {
    expect(shapeWatchingStats(watchingStats)).toEqual({
      totalMovies: 1946,
      moviesThisYear: 95,
      totalHours: 2440,
    });
  });

  it('throws when the payload has no data object', () => {
    expect(() => shapeWatchingStats({})).toThrow(/data/);
  });
});

describe('yearHeadline', () => {
  it('reads year and total_scrobbles from the year rollup', () => {
    expect(yearHeadline(listeningYear)).toEqual({ year: 2026, totalPlays: 1095 });
  });

  it('throws when the rollup lacks a total', () => {
    expect(() => yearHeadline({ year: 2026 })).toThrow(/total_scrobbles/);
  });
});

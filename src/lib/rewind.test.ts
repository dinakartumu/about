import { describe, expect, it } from 'vitest';
import {
  fmtWatchDate,
  monthRanges,
  shapePlacesStats,
  shapeRecentCheckins,
  shapeRecentWatches,
  shapeTopList,
  shapeTrends,
  shapeWatchingStats,
  starsFor,
  trendsAriaLabel,
  yearHeadline,
} from './rewind';
import listeningTrends2017 from './__fixtures__/listening-trends-2017.json';
import listeningTrends2024 from './__fixtures__/listening-trends-2024.json';
import listeningYear from './__fixtures__/listening-year.json';
import placesRecent from './__fixtures__/places-recent.json';
import placesStats from './__fixtures__/places-stats.json';
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

describe('shapePlacesStats', () => {
  it('reads headline numbers and top lists from the stats payload', () => {
    expect(shapePlacesStats(placesStats)).toEqual({
      total: 753,
      uniqueVenues: 264,
      thisYear: 0,
      topCategories: [
        { name: 'Bakery', count: 159 },
        { name: 'Coffee Shop', count: 85 },
        { name: 'Mexican Restaurant', count: 51 },
      ],
      topCities: [
        { name: 'Harrison', count: 225 },
        { name: 'Staten Island', count: 170 },
        { name: 'New York', count: 59 },
      ],
    });
  });

  it('throws when the payload lacks the headline numbers', () => {
    expect(() => shapePlacesStats({})).toThrow(/total/);
  });

  it('throws when the payload lacks the top lists', () => {
    expect(() => shapePlacesStats({ total: 1, unique_venues: 1, this_year: 0 })).toThrow(
      /top_categories/
    );
  });
});

describe('shapeRecentCheckins', () => {
  it('shapes check-ins to the rendered fields', () => {
    const checkins = shapeRecentCheckins(placesRecent);
    expect(checkins).toHaveLength(3);
    expect(checkins[0]).toEqual({
      venueName: '9/11 Tribute Center',
      category: 'Museum',
      place: 'New York, United States',
      date: 'Sep 11, 2016',
      shout: null,
    });
  });

  it('carries the shout through when present', () => {
    const checkins = shapeRecentCheckins(placesRecent);
    const withShout = checkins.find((c) => c.venueName === 'Sports Basement')!;
    expect(withShout.shout).toBe('Tire Puncture');
    expect(withShout.date).toBe('Jun 6, 2017');
  });

  it('omits null location parts when joining the place', () => {
    const checkins = shapeRecentCheckins(placesRecent);
    const noCity = checkins.find((c) => c.venueName === 'Alum Rock Creek Trail Trailhead')!;
    expect(noCity.place).toBe('United States');
  });

  it('returns an empty place when both city and country are null', () => {
    const shaped = shapeRecentCheckins({
      data: [
        {
          venue_name: 'Nowhere',
          venue_category: 'Mystery',
          venue_city: null,
          venue_country: null,
          checked_in_at: '2016-01-02T00:00:00.000Z',
          shout: null,
        },
      ],
    });
    expect(shaped[0].place).toBe('');
    expect(shaped[0].date).toBe('Jan 2, 2016');
  });

  it('throws when the payload has no data array', () => {
    expect(() => shapeRecentCheckins({})).toThrow(/data/);
  });
});

describe('shapeTrends', () => {
  const now = new Date('2026-07-20T12:00:00Z');

  it('maps a full historical year to twelve labeled points', () => {
    const points = shapeTrends(listeningTrends2024, 2024, now);
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ label: 'Jan', value: 581 });
    expect(points[4]).toEqual({ label: 'May', value: 835 });
    expect(points[11]).toEqual({ label: 'Dec', value: 445 });
  });

  it('zero-fills months missing from a historical year', () => {
    const points = shapeTrends(listeningTrends2017, 2017, now);
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ label: 'Jan', value: 0 });
    expect(points[8]).toEqual({ label: 'Sep', value: 0 });
    expect(points[9]).toEqual({ label: 'Oct', value: 860 });
    expect(points[11]).toEqual({ label: 'Dec', value: 429 });
  });

  it('runs the current year only through the current month', () => {
    const points = shapeTrends(
      {
        data: [
          { period: '2026-01', value: 719 },
          { period: '2026-07', value: 606 },
        ],
      },
      2026,
      now
    );
    expect(points.map((p) => p.label)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul']);
    expect(points[1].value).toBe(0);
    expect(points[6].value).toBe(606);
  });

  it('uses the UTC month for the current-year cutoff', () => {
    // 00:30 UTC on Jul 1 is still June in every western-hemisphere zone.
    const points = shapeTrends({ data: [] }, 2026, new Date('2026-07-01T00:30:00Z'));
    expect(points).toHaveLength(7);
  });

  it('normalizes count-keyed responses like watching and places trends', () => {
    const points = shapeTrends({ data: [{ period: '2024-03', count: 12 }] }, 2024, now);
    expect(points[2]).toEqual({ label: 'Mar', value: 12 });
  });

  it('returns all zeros for a year with no data', () => {
    const points = shapeTrends({ data: [] }, 2016, now);
    expect(points).toHaveLength(12);
    expect(points.every((p) => p.value === 0)).toBe(true);
  });

  it('returns no points for a year that has not started', () => {
    expect(shapeTrends({ data: [] }, 2027, now)).toEqual([]);
  });

  it('throws when the payload has no data array', () => {
    expect(() => shapeTrends({}, 2024, now)).toThrow(/data/);
  });
});

describe('trendsAriaLabel', () => {
  const now = new Date('2026-07-20T12:00:00Z');

  it('summarizes the peak month with the full month name', () => {
    const points = shapeTrends(listeningTrends2024, 2024, now);
    expect(trendsAriaLabel(points, 'plays')).toBe('Monthly plays, peak May 835');
  });

  it('formats thousands with separators', () => {
    expect(trendsAriaLabel([{ label: 'Jun', value: 1019 }], 'plays')).toBe(
      'Monthly plays, peak June 1,019'
    );
  });

  it('reports no data for an all-zero year', () => {
    expect(trendsAriaLabel([{ label: 'Jan', value: 0 }], 'plays')).toBe('Monthly plays, no data');
  });

  it('reports no data for an empty point list', () => {
    expect(trendsAriaLabel([], 'watches')).toBe('Monthly watches, no data');
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

import { describe, expect, it } from 'vitest';
import {
  activityFigures,
  buildArtistSparklines,
  buildGenreStacks,
  fmtDuration,
  fmtWatchDate,
  LISTENING_OTHER_COLOR,
  LISTENING_RAMP,
  monthRanges,
  sparklinePath,
  runningMonthlyPoints,
  shapeActivities,
  shapePlacesStats,
  shapeRecentCheckins,
  shapeRecentWatches,
  shapeRunningStats,
  shapeRunningYears,
  shapeTopList,
  shapeTrends,
  shapeWatchingStats,
  shapeWatchingYear,
  starsFor,
  trendsAriaLabel,
  trendsFirstYear,
  wideTrendsPath,
  yearHeadline,
} from './rewind';
import listeningTrends2017 from './__fixtures__/listening-trends-2017.json';
import listeningTrends2024 from './__fixtures__/listening-trends-2024.json';
import listeningYear from './__fixtures__/listening-year.json';
import placesRecent from './__fixtures__/places-recent.json';
import placesStats from './__fixtures__/places-stats.json';
import runningActivities2016 from './__fixtures__/running-activities-2016.json';
import runningStats from './__fixtures__/running-stats.json';
import runningYear2016 from './__fixtures__/running-year-2016.json';
import runningYears from './__fixtures__/running-years.json';
import topAlbums from './__fixtures__/top-albums.json';
import topArtists from './__fixtures__/top-artists.json';
import topTracks from './__fixtures__/top-tracks.json';
import watchingRecent from './__fixtures__/watching-recent.json';
import watchingStats from './__fixtures__/watching-stats.json';
import watchingTrendsWide from './__fixtures__/watching-trends-wide.json';
import watchingYear2024 from './__fixtures__/watching-year-2024.json';

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
      monthIndex: 6,
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
      total: 905,
      uniqueVenues: 442,
      thisYear: 204,
      topCategories: [
        {
          name: 'Structure',
          count: 97,
          icon: 'https://cdn.dinakartumu.com/places/icons/building-default_64.png',
        },
        {
          name: 'South Indian Restaurant',
          count: 66,
          icon: 'https://cdn.dinakartumu.com/places/icons/food-default_64.png',
        },
        {
          name: 'Grocery Store',
          count: 55,
          icon: 'https://cdn.dinakartumu.com/places/icons/shops-food_grocery_64.png',
        },
      ],
      topCities: [
        { name: 'Dublin', count: 198 },
        { name: 'Union City', count: 181 },
        { name: 'Fremont', count: 93 },
      ],
      topVenues: [
        {
          name: '580 Executive Center',
          city: 'Dublin',
          count: 87,
          icon: 'https://cdn.dinakartumu.com/places/icons/building-default_64.png',
        },
        {
          name: 'Union City BART Station',
          city: 'Union City',
          count: 50,
          icon: 'https://cdn.dinakartumu.com/places/icons/travel-subway_64.png',
        },
        {
          name: 'Sri Vasantha Bhavan',
          city: 'Dublin',
          count: 39,
          icon: 'https://cdn.dinakartumu.com/places/icons/food-default_64.png',
        },
      ],
    });
  });

  it('leaves icons null when a category or venue has none', () => {
    const shaped = shapePlacesStats({
      total: 2,
      unique_venues: 1,
      this_year: 0,
      top_categories: [{ category: 'Mystery', count: 2 }],
      top_cities: [],
      top_venues: [{ venue_name: 'Somewhere', count: 2, city: null }],
    });
    expect(shaped.topCategories[0].icon).toBeNull();
    expect(shaped.topVenues[0]).toEqual({ name: 'Somewhere', city: null, count: 2, icon: null });
  });

  it('throws when the payload lacks the headline numbers', () => {
    expect(() => shapePlacesStats({})).toThrow(/total/);
  });

  it('throws when the payload lacks the top lists', () => {
    expect(() => shapePlacesStats({ total: 1, unique_venues: 1, this_year: 0 })).toThrow(
      /top_categories/
    );
  });

  it('throws when the payload lacks the venue list', () => {
    expect(() =>
      shapePlacesStats({
        total: 1,
        unique_venues: 1,
        this_year: 0,
        top_categories: [],
        top_cities: [],
      })
    ).toThrow(/top_venues/);
  });
});

describe('shapeRecentCheckins', () => {
  it('shapes check-ins to the rendered fields', () => {
    const checkins = shapeRecentCheckins(placesRecent);
    expect(checkins).toHaveLength(3);
    expect(checkins[0]).toEqual({
      venueName: '9/11 Tribute Center',
      category: 'Museum',
      icon: 'https://ss3.4sqi.net/img/categories_v2/arts_entertainment/museum_64.png',
      place: 'New York, United States',
      date: 'Sep 11, 2016',
      shout: null,
    });
  });

  it('leaves the icon null when the venue has none', () => {
    const checkins = shapeRecentCheckins(placesRecent);
    const noIcon = checkins.find((c) => c.venueName === 'Alum Rock Creek Trail Trailhead')!;
    expect(noIcon.icon).toBeNull();
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

describe('shapeTrends year filtering', () => {
  const now = new Date('2026-07-20T12:00:00Z');

  it('ignores buckets from other years in a multi-year response', () => {
    const points = shapeTrends(watchingTrendsWide, 2024, now);
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ label: 'Jan', value: 15 });
    expect(points[9]).toEqual({ label: 'Oct', value: 18 });
    expect(points[11]).toEqual({ label: 'Dec', value: 10 });
  });

  it('does not let another year fill a month that is empty in the target year', () => {
    const points = shapeTrends(
      { data: [{ period: '2023-03', count: 9 }] },
      2024,
      now
    );
    expect(points[2]).toEqual({ label: 'Mar', value: 0 });
  });
});

describe('wideTrendsPath', () => {
  it('builds the encoded probe path for a domain', () => {
    expect(wideTrendsPath('watching', 2026)).toBe(
      '/v1/watching/trends?from=2000-01-01T00%3A00%3A00Z&to=2026-12-31T23%3A59%3A59Z'
    );
  });
});

describe('trendsFirstYear', () => {
  it('returns the earliest year in a trends response', () => {
    expect(trendsFirstYear(watchingTrendsWide)).toBe(2012);
  });

  it('does not assume the buckets are sorted', () => {
    expect(
      trendsFirstYear({
        data: [
          { period: '2019-04', count: 1 },
          { period: '2014-01', count: 2 },
        ],
      })
    ).toBe(2014);
  });

  it('throws when the payload has no data array', () => {
    expect(() => trendsFirstYear({})).toThrow(/data/);
  });

  it('throws when the response has no buckets', () => {
    expect(() => trendsFirstYear({ data: [] })).toThrow(/empty/);
  });
});

describe('shapeWatchingYear', () => {
  it('reads the film count and monthly buckets from the year rollup', () => {
    const shaped = shapeWatchingYear(watchingYear2024);
    expect(shaped.year).toBe(2024);
    expect(shaped.totalMovies).toBe(106);
    expect(shaped.monthly).toHaveLength(12);
    expect(shaped.monthly[0]).toEqual({ period: '2024-01', count: 15 });
  });

  it('feeds shapeTrends through the normalized monthly buckets', () => {
    const shaped = shapeWatchingYear(watchingYear2024);
    const points = shapeTrends({ data: shaped.monthly }, 2024, new Date('2026-07-20T12:00:00Z'));
    expect(points[9]).toEqual({ label: 'Oct', value: 18 });
  });

  it('throws when the rollup lacks a film total', () => {
    expect(() => shapeWatchingYear({ year: 2024, monthly: [] })).toThrow(/total_movies/);
  });

  it('throws when the rollup lacks the monthly breakdown', () => {
    expect(() => shapeWatchingYear({ year: 2024, total_movies: 5 })).toThrow(/monthly/);
  });
});

describe('fmtDuration', () => {
  it('formats hours and minutes', () => {
    expect(fmtDuration(245924)).toBe('68h 19m');
    expect(fmtDuration(11352)).toBe('3h 9m');
  });

  it('drops the hour part under an hour', () => {
    expect(fmtDuration(2700)).toBe('45m');
  });

  it('carries a rounded 60 minutes into the next hour', () => {
    expect(fmtDuration(3580)).toBe('1h 0m');
  });

  it('formats zero as zero minutes', () => {
    expect(fmtDuration(0)).toBe('0m');
  });
});

describe('shapeRunningStats', () => {
  it('reads the lifetime numbers and parses the duration to seconds', () => {
    expect(shapeRunningStats(runningStats)).toEqual({
      totalRuns: 182,
      totalActivities: 1331,
      totalMiles: 690.73,
      totalDurationS: 930026,
      avgPace: '11:45/mi',
    });
  });

  it('throws when the payload has no data object', () => {
    expect(() => shapeRunningStats({})).toThrow(/data/);
  });

  it('throws when the payload lacks an activity total', () => {
    expect(() =>
      shapeRunningStats({
        data: {
          total_runs: 1,
          total_distance_mi: 1,
          total_duration: '9:05',
          avg_pace: null,
        },
      })
    ).toThrow(/total_activities/);
  });

  it('throws on an unparseable duration', () => {
    expect(() =>
      shapeRunningStats({
        data: {
          total_runs: 1,
          total_activities: 1,
          total_distance_mi: 1,
          total_duration: 'soon',
          avg_pace: null,
        },
      })
    ).toThrow(/duration/);
  });
});

describe('shapeRunningYears', () => {
  it('shapes each year summary to the rendered fields', () => {
    const years = shapeRunningYears(runningYears);
    expect(years).toHaveLength(7);
    expect(years[0]).toEqual({
      year: 2026,
      totalRuns: 3,
      totalMiles: 5.91,
      totalDurationS: 5421,
      avgPace: '15:17/mi',
    });
  });

  it('carries a null average pace through', () => {
    const years = shapeRunningYears({
      data: [
        {
          year: 2020,
          total_runs: 0,
          total_distance_mi: 0,
          total_duration_s: 0,
          avg_pace: null,
        },
      ],
    });
    expect(years[0].avgPace).toBeNull();
  });

  it('throws when the payload has no data array', () => {
    expect(() => shapeRunningYears({})).toThrow(/data/);
  });
});

describe('runningMonthlyPoints', () => {
  const now = new Date('2026-07-20T12:00:00Z');

  it('turns the year rollup monthly breakdown into run-count points', () => {
    const points = runningMonthlyPoints(runningYear2016, 2016, now);
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ label: 'Jan', value: 0 });
    expect(points[3]).toEqual({ label: 'Apr', value: 8 });
    expect(points[4]).toEqual({ label: 'May', value: 13 });
  });

  it('throws when the rollup lacks the monthly breakdown', () => {
    expect(() => runningMonthlyPoints({ year: 2016 }, 2016, now)).toThrow(/monthly/);
  });
});

describe('shapeActivities', () => {
  it('shapes activities to the rendered fields', () => {
    const runs = shapeActivities(runningActivities2016);
    expect(runs).toHaveLength(3);
    expect(runs[0]).toEqual({
      name: 'Afternoon Ride',
      date: 'Dec 26, 2016',
      monthIndex: 11,
      distanceMi: 5.22,
      durationS: 2065,
      calories: 136.4,
      pace: '6:36/mi',
      sport: 'Ride',
      isRun: false,
      stravaUrl: 'https://www.strava.com/activities/1113442572',
      place: 'Mira Mesa, California',
      routePath: expect.stringMatching(/^M \d+(\.\d)?,\d+(\.\d)? L /),
    });
  });

  it('joins city and state into a place, null when both are missing', () => {
    const base = {
      name: 'x',
      sport_type: 'Run',
      date: '2016-01-02T10:00:00Z',
      distance_mi: 1,
      duration_s: 600,
      pace: '10:00/mi',
      calories: null,
      strava_url: null,
      polyline: null,
    };
    const runs = shapeActivities({
      data: [
        { ...base, city: 'Union City', state: 'California' },
        { ...base, city: 'Ongole', state: null },
        { ...base, city: null, state: 'California' },
        { ...base, city: null, state: null },
      ],
    });
    expect(runs.map((r) => r.place)).toEqual([
      'Union City, California',
      'Ongole',
      'California',
      null,
    ]);
  });

  it('leaves the route path null without a decodable polyline', () => {
    const base = {
      name: 'x',
      sport_type: 'WeightTraining',
      date: '2016-01-02T10:00:00Z',
      distance_mi: 0,
      duration_s: 2700,
      pace: '0:00/mi',
      calories: null,
      strava_url: null,
      city: null,
      state: null,
    };
    const runs = shapeActivities({
      data: [
        { ...base, polyline: null },
        { ...base }, // field absent entirely — older cached payloads
        { ...base, polyline: '' }, // empty string decodes to zero points
      ],
    });
    expect(runs.map((r) => r.routePath)).toEqual([null, null, null]);
  });

  it('marks run-type sports and spaces out camel-cased labels', () => {
    const runs = shapeActivities({
      data: [
        {
          name: 'Hill repeats',
          sport_type: 'TrailRun',
          date: '2016-01-02T10:00:00Z',
          distance_mi: 3.1,
          duration_s: 1860,
          pace: '10:00/mi',
          calories: 350,
          strava_url: null,
        },
        {
          name: 'Zwift',
          sport_type: 'VirtualRun',
          date: '2016-01-03T10:00:00Z',
          distance_mi: 2,
          duration_s: 1080,
          pace: '9:00/mi',
          calories: null,
          strava_url: null,
        },
        {
          name: 'Gym',
          sport_type: 'WeightTraining',
          date: '2016-01-04T10:00:00Z',
          distance_mi: 0,
          duration_s: 2700,
          pace: '0:00/mi',
          calories: 320,
          strava_url: null,
        },
      ],
    });
    expect(runs[0].sport).toBe('Trail Run');
    expect(runs[0].isRun).toBe(true);
    expect(runs[1].sport).toBe('Virtual Run');
    expect(runs[1].isRun).toBe(true);
    expect(runs[2].sport).toBe('Weight Training');
    expect(runs[2].isRun).toBe(false);
  });

  it('leaves the strava link null when the API has none', () => {
    const runs = shapeActivities({
      data: [
        {
          name: 'Treadmill',
          sport_type: 'Run',
          date: '2016-01-02T10:00:00Z',
          distance_mi: 1.5,
          duration_s: 900,
          pace: '10:00/mi',
          calories: null,
          strava_url: null,
        },
      ],
    });
    expect(runs[0].stravaUrl).toBeNull();
    expect(runs[0].date).toBe('Jan 2, 2016');
    expect(runs[0].sport).toBe('Run');
    expect(runs[0].isRun).toBe(true);
    expect(runs[0].calories).toBeNull();
    expect(runs[0].durationS).toBe(900);
  });

  it('throws when the payload has no data array', () => {
    expect(() => shapeActivities({})).toThrow(/data/);
  });
});

describe('activityFigures', () => {
  const base = {
    name: 'x',
    date: 'Jan 2, 2016',
    stravaUrl: null,
    place: null,
    routePath: null,
  };

  it('shows sport, distance, and pace for runs with distance', () => {
    const figures = activityFigures({
      ...base,
      sport: 'Run',
      isRun: true,
      distanceMi: 4.49,
      durationS: 2162,
      calories: 525,
      pace: '8:02/mi',
    });
    expect(figures).toBe('Run · 4.49 mi · 8:02/mi');
  });

  it('omits pace for non-run sports with distance', () => {
    const figures = activityFigures({
      ...base,
      sport: 'Ride',
      isRun: false,
      distanceMi: 5.22,
      durationS: 2065,
      calories: 136.4,
      pace: '6:36/mi',
    });
    expect(figures).toBe('Ride · 5.22 mi');
  });

  it('omits a zeroed pace even for runs', () => {
    const figures = activityFigures({
      ...base,
      sport: 'Run',
      isRun: true,
      distanceMi: 1.5,
      durationS: 900,
      calories: null,
      pace: '0:00/mi',
    });
    expect(figures).toBe('Run · 1.5 mi');
  });

  it('shows duration and calories for zero-distance activities', () => {
    const figures = activityFigures({
      ...base,
      sport: 'Weight Training',
      isRun: false,
      distanceMi: 0,
      durationS: 2700,
      calories: 320,
      pace: '0:00/mi',
    });
    expect(figures).toBe('Weight Training · 45 min · 320 cal');
  });

  it('formats hour-long zero-distance durations as hours and minutes', () => {
    const figures = activityFigures({
      ...base,
      sport: 'Weight Training',
      isRun: false,
      distanceMi: 0,
      durationS: 4013,
      calories: 322.4,
      pace: '0:00/mi',
    });
    expect(figures).toBe('Weight Training · 1h 7m · 322 cal');
  });

  it('shows only the duration when calories are missing or zero', () => {
    const noCal = activityFigures({
      ...base,
      sport: 'Workout',
      isRun: false,
      distanceMi: 0,
      durationS: 2520,
      calories: null,
      pace: '0:00/mi',
    });
    expect(noCal).toBe('Workout · 42 min');
    const zeroCal = activityFigures({
      ...base,
      sport: 'Workout',
      isRun: false,
      distanceMi: 0,
      durationS: 252,
      calories: 0,
      pace: '0:00/mi',
    });
    expect(zeroCal).toBe('Workout · 4 min');
  });

  it('shows seconds for sub-minute durations instead of "0 min"', () => {
    const figures = activityFigures({
      ...base,
      sport: 'Workout',
      isRun: false,
      distanceMi: 0,
      durationS: 20,
      calories: 0,
      pace: '0:00/mi',
    });
    expect(figures).toBe('Workout · 20s');
  });

  it('treats near-zero distances as zero-distance activities', () => {
    const figures = activityFigures({
      ...base,
      sport: 'Yoga',
      isRun: false,
      distanceMi: 0.04,
      durationS: 1800,
      calories: 90,
      pace: '0:00/mi',
    });
    expect(figures).toBe('Yoga · 30 min · 90 cal');
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

describe('buildGenreStacks', () => {
  it('ranks named genres and folds the API Other bucket into the tail', () => {
    const jan = { Pop: 100, Soundtrack: 60, Other: 40 };
    const stacks = buildGenreStacks([jan], [200]);
    const s = stacks[0];
    expect(s.label).toBe('Jan');
    expect(s.total).toBe(200);
    expect(s.segments.map((seg) => [seg.name, seg.value, seg.color])).toEqual([
      ['Pop', 100, LISTENING_RAMP[0]],
      ['Soundtrack', 60, LISTENING_RAMP[1]],
      ['Other', 40, LISTENING_OTHER_COLOR],
    ]);
  });

  it('sets bar length to the play total, folding untagged plays into Other', () => {
    // 100 tagged plays (Pop) but 500 total plays: bar = 500, Other = 400.
    const [s] = buildGenreStacks([{ Pop: 100 }], [500]);
    expect(s.total).toBe(500);
    expect(s.segments).toEqual([
      { name: 'Pop', value: 100, color: LISTENING_RAMP[0] },
      { name: 'Other', value: 400, color: LISTENING_OTHER_COLOR },
    ]);
  });

  it('never clips below the shown genre sum when totals lag the genre data', () => {
    const genres: Record<string, number> = {};
    for (let i = 0; i < LISTENING_RAMP.length + 2; i++) genres[`G${i}`] = 10 - i;
    const genreSum = Object.values(genres).reduce((a, b) => a + b, 0);
    const [s] = buildGenreStacks([genres], [0]); // total lags → falls back to genreSum
    expect(s.total).toBe(genreSum);
    expect(s.segments).toHaveLength(LISTENING_RAMP.length + 1); // ramp + Other
    expect(s.segments.at(-1)?.name).toBe('Other');
  });

  it('returns 12 labeled months, empty where there is no data', () => {
    const stacks = buildGenreStacks([], []);
    expect(stacks).toHaveLength(12);
    expect(stacks.every((s) => s.total === 0 && s.segments.length === 0)).toBe(true);
    expect(stacks.map((s) => s.label)).toEqual([
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]);
  });
});

describe('buildArtistSparklines', () => {
  const a = (name: string, playcount: number) => ({
    rank: 1, name, detail: '', playcount, image: null, link: null,
  });

  it('builds a 12-point monthly series per name, zero when absent', () => {
    const monthly = [[a('X', 5)], undefined, [a('X', 9), a('Y', 2)]];
    const series = buildArtistSparklines(monthly, ['X', 'Y']);
    expect(series.X).toHaveLength(12);
    expect(series.X.slice(0, 3)).toEqual([5, 0, 9]);
    expect(series.Y.slice(0, 3)).toEqual([0, 0, 2]);
  });
});

describe('sparklinePath', () => {
  it('starts with a move command and stays within the box height', () => {
    const d = sparklinePath([0, 10, 5, 20], 96, 16);
    expect(d.startsWith('M ')).toBe(true);
    const ys = [...d.matchAll(/[ML] [\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(16);
  });

  it('renders a centered flat line for an empty series', () => {
    expect(sparklinePath([], 96, 16)).toBe('M 0,8.00 L 96,8.00');
  });
});

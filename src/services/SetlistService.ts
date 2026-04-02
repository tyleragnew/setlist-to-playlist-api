import { Injectable, Logger } from '@nestjs/common';
import {
  SetlistFMClient,
  SetlistMetadata,
  SongEntry,
} from '../clients/SetlistFMClient';

export { SongEntry };

type SongStat = {
  title: string;
  coverArtist?: string;
  tape?: boolean;
  occurrences: number;
  position: number[];
};

export type SearchMode =
  | { mode: 'recent'; numberOfSets: number }
  | { mode: 'tour'; tourName: string }
  | { mode: 'year'; year: number };

export type AverageSetlist = {
  artistName: string;
  averageSetLength: number;
  songs: SongEntry[];
  similarity: number;
  showCount: number;
  playlistDescription?: string;
  preferLive?: boolean;
};

export type ShowInfo = {
  date: string;
  venue: string;
  city: string;
  country: string;
  tourName: string | null;
};

export type ArtistShowMeta = {
  artistName: string;
  currentTour: string | null;
  recentShows: ShowInfo[];
  beginYear: number | null;
  endYear: number | null;
};

@Injectable()
export class SetlistService {
  private readonly logger = new Logger(SetlistService.name);

  constructor(private readonly setlistFMClient: SetlistFMClient) {}

  async getArtistShowMeta(artistId: string): Promise<ArtistShowMeta> {
    const data = await this.setlistFMClient.getSetlistsByArtistName(artistId);
    // Reuse page 1 data for year range to avoid duplicate API call and rate limits
    const activeYears = await this.setlistFMClient.getArtistSetlistYearRange(
      artistId,
      data,
    );
    const setlists = data?.setlist ?? [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parseDate = (dateStr: string): Date => {
      // setlist.fm format: dd-MM-yyyy
      const [day, month, year] = dateStr.split('-');
      return new Date(Number(year), Number(month) - 1, Number(day));
    };

    const toShowInfo = (s: any): ShowInfo => ({
      date: s.eventDate,
      venue: s.venue?.name ?? '',
      city: s.venue?.city?.name ?? '',
      country: s.venue?.city?.country?.name ?? '',
      tourName: s.tour?.name ?? null,
    });

    const recent: ShowInfo[] = [];

    for (const s of setlists) {
      if (!s.eventDate) continue;
      const d = parseDate(s.eventDate);
      if (d <= today && recent.length < 5) {
        recent.push(toShowInfo(s));
      }
    }

    // Determine current tour: if the most recent show was within the last 90 days
    // and has a tour name, consider them currently on tour
    let currentTour: string | null = null;
    if (setlists[0]?.eventDate) {
      const mostRecentDate = parseDate(setlists[0].eventDate);
      const daysSince = Math.floor(
        (today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSince <= 90 && setlists[0]?.tour?.name) {
        currentTour = setlists[0].tour.name;
      }
    }

    const artistName = setlists[0]?.artist?.name ?? '';

    return {
      artistName,
      currentTour,
      recentShows: recent,
      beginYear: activeYears.beginYear,
      endYear: activeYears.endYear,
    };
  }

  async getAverageSetlistByArtistName(
    artistId: string,
    numberOfSets: number,
    allSongs = false,
  ) {
    return this.getAverageSetlist(
      artistId,
      { mode: 'recent', numberOfSets },
      allSongs,
    );
  }

  async getAverageSetlist(
    artistId: string,
    searchMode: SearchMode,
    allSongs = false,
  ): Promise<AverageSetlist> {
    let rawData: any;

    switch (searchMode.mode) {
      case 'recent':
        rawData = await this.setlistFMClient.getSetlistsByArtistName(artistId);
        break;
      case 'tour':
        rawData = await this.setlistFMClient.searchSetlistsByTour(
          artistId,
          searchMode.tourName,
        );
        break;
      case 'year':
        rawData = await this.setlistFMClient.searchSetlistsByYear(
          artistId,
          searchMode.year,
        );
        break;
    }

    const rawSetlists = rawData?.setlist ?? [];
    const sliceCount =
      searchMode.mode === 'recent'
        ? searchMode.numberOfSets
        : rawSetlists.length;

    // Compile all sets
    const sets = rawSetlists.slice(0, sliceCount).map((obj: any) => obj.sets);

    const songs: SongEntry[][] = [];

    for (let x = 0; x < sets.length; x++) {
      // Get songs from the main set and encores in a single list
      const rawSongs = sets[x].set.map((i: any) => i.song).flat();
      songs.push(
        rawSongs
          .filter((s: any) => s.name && s.name.trim())
          .map((s: any) => {
            const entry: SongEntry = { title: s.name.trim() };
            if (s.tape) {
              entry.tape = true;
            }
            if (s.cover?.name) {
              entry.coverArtist = s.cover.name;
            }
            return entry;
          }),
      );
    }

    // Return only sets that have songs
    const setsWithSongs = songs.filter(
      (subArray: any[]) => subArray.length > 0,
    );

    const artistName = rawSetlists[0]?.artist?.name ?? '';

    const setlistMetadata: SetlistMetadata = {
      setlists: setsWithSongs,
      artistName,
      mbid: artistId,
    };

    let setlistLength = 0;

    this.logger.log(`Number of Setlists: ${setlistMetadata.setlists.length}`);

    // Get number of songs in average set list and add to dictionary
    setlistMetadata.setlists.forEach((x) => {
      setlistLength = setlistLength + x.length;
    });

    const averageSetListLength: number = Math.round(
      setlistLength / setlistMetadata.setlists.length,
    );

    const averageSetlist: AverageSetlist = {
      artistName: setlistMetadata.artistName,
      averageSetLength: averageSetListLength,
      songs: this.compileSongStats(
        setlistMetadata.setlists,
        allSongs ? Infinity : averageSetListLength,
      ).map((i) => {
        const entry: SongEntry = { title: i.title };
        if (i.coverArtist) entry.coverArtist = i.coverArtist;
        if (i.tape) entry.tape = true;
        return entry;
      }),
      similarity: this.calculateSetlistSimilarity(setlistMetadata.setlists),
      showCount: setsWithSongs.length,
    };

    return averageSetlist;
  }

  compileSongStats(listOfSetlists: SongEntry[][], numberOfSongs: number) {
    const songStats: SongStat[] = [];

    // Loop through the list of sets and add to SongStat list
    listOfSetlists.forEach((set) => {
      if (set.length > 0) {
        set.forEach((songEntry, songIndex) => {
          const key = songEntry.title.toUpperCase();
          // skip blank songs
          if (key === '') {
          }
          // check if exists, if it does update
          else if (songStats.some((obj) => obj.title.toUpperCase() === key)) {
            const indexId = songStats.findIndex(
              (obj) => obj.title.toUpperCase() === key,
            );
            songStats[indexId].occurrences++;
            songStats[indexId].position.push(songIndex + 1);
          }
          // else create — preserve original case from setlist.fm
          else {
            const stat: SongStat = {
              title: songEntry.title,
              occurrences: 1,
              position: [songIndex + 1],
            };
            if (songEntry.coverArtist) stat.coverArtist = songEntry.coverArtist;
            if (songEntry.tape) stat.tape = true;
            songStats.push(stat);
          }
        });
      }
    });

    const sorted = songStats.sort((a, b) => b.occurrences - a.occurrences);
    const trimmed =
      numberOfSongs === Infinity ? sorted : sorted.splice(0, numberOfSongs);

    return trimmed.sort(
      (a, b) =>
        this.getAverageOfListOfNumbers(a.position) -
        this.getAverageOfListOfNumbers(b.position),
    );
  }

  calculateSetlistSimilarity(setlists: SongEntry[][]): number {
    if (setlists.length < 2) return 100;

    const normalizedSets = setlists.map(
      (set) => new Set(set.map((s) => s.title.toUpperCase())),
    );

    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < normalizedSets.length; i++) {
      for (let j = i + 1; j < normalizedSets.length; j++) {
        const a = normalizedSets[i];
        const b = normalizedSets[j];
        let intersection = 0;
        for (const song of a) {
          if (b.has(song)) intersection++;
        }
        const union = new Set([...a, ...b]).size;
        totalSimilarity += union === 0 ? 0 : intersection / union;
        pairCount++;
      }
    }

    return Math.round((totalSimilarity / pairCount) * 100);
  }

  getAverageOfListOfNumbers(list: number[]) {
    const sum = list.reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      0,
    );
    return sum / list.length;
  }
}

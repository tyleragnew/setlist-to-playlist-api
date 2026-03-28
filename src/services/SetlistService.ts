import { Injectable } from '@nestjs/common';
import {
  SetlistFMClient,
  SetlistMetadata,
  SongEntry,
} from '../clients/SetlistFMClient';

export { SongEntry };

type SongStat = {
  title: string;
  coverArtist?: string;
  occurrences: number;
  position: number[];
};

export type AverageSetlist = {
  artistName: string;
  averageSetLength: number;
  songs: SongEntry[];
  similarity: number;
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
};

@Injectable()
export class SetlistService {
  constructor(private readonly setlistFMClient: SetlistFMClient) {}

  async getArtistShowMeta(artistId: string): Promise<ArtistShowMeta> {
    const data = await this.setlistFMClient.getSetlistsByArtistName(artistId);
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
      const daysSince = Math.floor((today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 90 && setlists[0]?.tour?.name) {
        currentTour = setlists[0].tour.name;
      }
    }

    const artistName = setlists[0]?.artist?.name ?? '';

    return {
      artistName,
      currentTour,
      recentShows: recent,
    };
  }

  async getAverageSetlistByArtistName(artistId: string, numberOfSets: number, allSongs = false) {
    const setlistsByArtist = await this.setlistFMClient
      .getSetlistsByArtistName(artistId)
      .then((res) => {
        return res;
      });

    // Compile all sets
    const sets = setlistsByArtist.setlist
      .slice(0, numberOfSets)
      .map((obj) => obj.sets);

    const songs: SongEntry[][] = [];

    for (let x = 0; x < sets.length; x++) {
      // Get songs from the main set and encores in a single list
      const rawSongs = sets[x].set
        .map((i) => i.song)
        .flat();
      songs.push(
        rawSongs
          .filter((s) => s.name && s.name.trim())
          .map((s) => {
            const entry: SongEntry = { title: s.name.trim() };
            // If it's a tape cover, preserve the original artist for Spotify search
            if (s.tape && s.cover?.name) {
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

    // Determine how many shows to include in the average (use requested numberOfSets or available)
    const numberOfShowsToReturn =
      numberOfSets && numberOfSets > 0
        ? Math.min(numberOfSets, setsWithSongs.length)
        : setsWithSongs.length;

    const setlistMetadata: SetlistMetadata = {
      setlists: setsWithSongs.slice(0, numberOfShowsToReturn),
      artistName: setlistsByArtist.setlist[0].artist.name,
      mbid: setlistsByArtist.artistMBID,
    };

    let setlistLength = 0;

    console.log('Number of Setlists: ' + setlistMetadata.setlists.length);

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
        return entry;
      }),
      similarity: this.calculateSetlistSimilarity(setlistMetadata.setlists),
    };

    return averageSetlist;
  }

  compileSongStats(listOfSetlists: SongEntry[][], numberOfSongs: number) {
    const songStats: SongStat[] = [];

    // Loop through the list of sets and add to SongStat list
    listOfSetlists.forEach((set) => {
      if (set.length > 0) {
        set.forEach((songEntry, songIndex) => {
          const title = songEntry.title.toUpperCase();
          // skip blank songs
          if (title === '') {
          }
          // check if exists, if it does update
          else if (songStats.some((obj) => obj.title === title)) {
            const indexId = songStats.findIndex((obj) => obj.title === title);
            songStats[indexId].occurrences++;
            songStats[indexId].position.push(songIndex + 1);
          }
          // else create
          else {
            const stat: SongStat = {
              title,
              occurrences: 1,
              position: [songIndex + 1],
            };
            if (songEntry.coverArtist) stat.coverArtist = songEntry.coverArtist;
            songStats.push(stat);
          }
        });
      }
    });

    const sorted = songStats.sort((a, b) => b.occurrences - a.occurrences);
    const trimmed = numberOfSongs === Infinity ? sorted : sorted.splice(0, numberOfSongs);

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

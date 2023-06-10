import { Injectable } from '@nestjs/common';
import { SetlistFMClient, SetlistMetadata } from 'src/clients/SetlistFMClient';

type SongStat = {
  title: string;
  occurrences: number;
  position: number[];
};

export type AverageSetlist = {
  artistName: string;
  averageSetLength: number;
  songs: string[];
};

@Injectable()
export class SetlistService {
  constructor(private readonly setlistFMClient: SetlistFMClient) {}

  async getAverageSetlistByArtistName(artistId: string, numberOfSets: number) {
    const setlistsByArtist = await this.setlistFMClient
      .getSetlistsByArtistName(artistId)
      .then((res) => {
        return res;
      });

    // Compile all sets
    const sets = setlistsByArtist.setlist.map((obj) => obj.sets);

    const songs: string[][] = [];

    for (let x = 0; x < sets.length; x++) {
      // Get songs from the main set and encores in a single list
      songs.push(
        sets[x].set
          .map((i) => i.song)
          .flat()
          .map((x) => x.name.trim()),
      );
    }

    // Return only sets that have songs
    const setsWithSongs = songs.filter(
      (subArray: any[]) => subArray.length > 0,
    );

    const numberOfShowsToReturn =
      numberOfSets < setsWithSongs.length ? numberOfSets : setsWithSongs.length;

    const setlistMetadata: SetlistMetadata = {
      setlists: setsWithSongs.slice(0, numberOfShowsToReturn),
      artistName: setlistsByArtist.setlist[0].artist.name,
      mbid: setlistsByArtist.artistMBID,
    };

    let setlistLength = 0;

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
        averageSetListLength,
      ).map((i) => i.title),
    };

    return averageSetlist;
  }

  compileSongStats(listOfSetlists: string[][], numberOfSongs: number) {
    const songStats: SongStat[] = [];
    let songStat: SongStat;

    // Loop through the list of sets and add to SongStat list
    listOfSetlists.forEach((set, setIndex, listOfSetlists) => {
      if (set.length > 0) {
        set.forEach((song, songIndex, set) => {
          song = song.toUpperCase();
          // skip blank songs
          if (song === '') {
          }
          // check if exists, if it does update
          else if (songStats.some((obj) => obj.title === song)) {
            const indexId = songStats.findIndex((obj) => obj.title === song);
            songStats[indexId].occurrences++,
              songStats[indexId].position.push(songIndex + 1);
          }
          // else create
          else {
            songStat = {
              title: song,
              occurrences: 1,
              position: [songIndex + 1],
            };
            songStats.push(songStat);
          }
        });
      }
    });

    return (
      songStats
        // Sort by number of occurrences
        .sort((a, b) => b.occurrences - a.occurrences)
        // Keep the highest occurring x number of average set
        .splice(0, numberOfSongs)
        // Sort by average position in the set
        .sort(
          (a, b) =>
            this.getAverageOfListOfNumbers(a.position) -
            this.getAverageOfListOfNumbers(b.position),
        )
    );
  }

  getAverageOfListOfNumbers(list: number[]) {
    const sum = list.reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      0,
    );
    return sum / list.length;
  }
}

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { stringify } from 'querystring';
import { retry } from 'rxjs';
import { SETLIST_FM_BASE_URL, X_API_KEY } from 'src/constants';

@Injectable()
export class SetlistFMClient {
  constructor(private readonly httpService: HttpService) {}

  headers = {
    Accept: 'application/json',
    'x-api-key': X_API_KEY,
  };

  requestConfig: AxiosRequestConfig = {
    headers: this.headers,
  };

  async getSetlistsByArtistName(artistName: string, numberOfSets: number) {
    // @TODO - figure out why I can't add query Params this way
    const params = {
      artistName: artistName,
    };

    const requestConfig: AxiosRequestConfig = {
      headers: this.headers,
    };

    try {
      const songs: string[][] = [];
      // Setlist.FM automatically shows the most recent shows first.
      const response = await this.httpService
        .get(
          SETLIST_FM_BASE_URL + `search/setlists?artistName=${artistName}`,
          requestConfig,
        )
        .toPromise();
      // Compile all sets
      const sets = response.data.setlist.map((obj) => obj.sets);

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
        numberOfSets < setsWithSongs.length
          ? numberOfSets
          : setsWithSongs.length;
      return setsWithSongs.slice(0, numberOfShowsToReturn);
    } catch (error) {
      error.stat;
      console.log(error);
    }
  }
}

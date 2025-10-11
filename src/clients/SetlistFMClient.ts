import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { SETLIST_FM_BASE_URL, X_API_KEY } from '../constants';

export type SetlistMetadata = {
  artistName: string;
  mbid: string;
  setlists: string[][];
};

const headers = {
  Accept: 'application/json',
  'x-api-key': X_API_KEY,
};

@Injectable()
export class SetlistFMClient {
  constructor(private readonly httpService: HttpService) {}
  async getSetlistsByArtistName(artistMBID: string, numberOfSets: number) {
    try {
      // Setlist.FM automatically shows the most recent shows first.
      const response = await this.httpService
        .get(
          SETLIST_FM_BASE_URL +
            `artist/${artistMBID}/setlists?p=${numberOfSets}`,
          { headers },
        )
        .toPromise();
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }
}

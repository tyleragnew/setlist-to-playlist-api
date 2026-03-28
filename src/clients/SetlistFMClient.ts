import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { SETLIST_FM_BASE_URL, X_API_KEY } from '../constants';

export type SongEntry = {
  title: string;
  coverArtist?: string;
  tape?: boolean;
};

export type SetlistMetadata = {
  artistName: string;
  mbid: string;
  setlists: SongEntry[][];
};

const headers = {
  Accept: 'application/json',
  'x-api-key': X_API_KEY,
};

@Injectable()
export class SetlistFMClient {
  constructor(private readonly httpService: HttpService) {}
  async getSetlistsByArtistName(artistMBID: string) {
    try {
      // Setlist.FM automatically shows the most recent shows first.
      const response = await this.httpService
        .get(SETLIST_FM_BASE_URL + `artist/${artistMBID}/setlists`, { headers })
        .toPromise();
      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async searchSetlistsByTour(
    artistMBID: string,
    tourName: string,
  ): Promise<any> {
    return this.paginateSearch({
      artistMbid: artistMBID,
      tourName,
    });
  }

  async searchSetlistsByYear(artistMBID: string, year: number): Promise<any> {
    return this.paginateSearch({
      artistMbid: artistMBID,
      year: String(year),
    });
  }

  async getArtistSetlistYearRange(
    artistMBID: string,
    existingPageOneData?: any,
  ): Promise<{ beginYear: number | null; endYear: number | null }> {
    try {
      const pageOneData =
        existingPageOneData ??
        (
          await this.httpService
            .get(SETLIST_FM_BASE_URL + `artist/${artistMBID}/setlists?p=1`, {
              headers,
            })
            .toPromise()
        ).data;

      const total = pageOneData?.total ?? 0;
      const itemsPerPage = pageOneData?.itemsPerPage ?? 20;
      const firstSetlists = pageOneData?.setlist ?? [];

      if (total === 0 || firstSetlists.length === 0) {
        return { beginYear: null, endYear: null };
      }

      // Extract year from dd-MM-yyyy format
      const getYear = (dateStr: string) => Number(dateStr.split('-')[2]);

      // Most recent year from page 1
      const endYear = getYear(firstSetlists[0].eventDate);

      // Fetch last page to get the oldest show
      const lastPageNum = Math.ceil(total / itemsPerPage);
      let beginYear = endYear;

      if (lastPageNum > 1) {
        const lastPage = await this.httpService
          .get(
            SETLIST_FM_BASE_URL +
              `artist/${artistMBID}/setlists?p=${lastPageNum}`,
            { headers },
          )
          .toPromise();

        const lastSetlists = lastPage.data?.setlist ?? [];
        if (lastSetlists.length > 0) {
          beginYear = getYear(lastSetlists[lastSetlists.length - 1].eventDate);
        }
      }

      return { beginYear, endYear };
    } catch (error) {
      console.error('Error fetching setlist year range:', error);
      return { beginYear: null, endYear: null };
    }
  }

  private async paginateSearch(
    params: Record<string, string>,
  ): Promise<{ setlist: any[] }> {
    const allSetlists: any[] = [];
    let page = 1;
    let total = 0;

    do {
      const response = await this.httpService
        .get(SETLIST_FM_BASE_URL + 'search/setlists', {
          headers,
          params: { ...params, p: String(page) },
        })
        .toPromise();

      const data = response.data;
      const setlists = data?.setlist ?? [];
      allSetlists.push(...setlists);
      total = data?.total ?? 0;
      page++;

      // Small delay to respect rate limits
      if (page * 20 < total) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } while (allSetlists.length < total);

    return { setlist: allSetlists };
  }
}

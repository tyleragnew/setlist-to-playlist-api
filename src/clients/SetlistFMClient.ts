import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { SETLIST_FM_BASE_URL, X_API_KEY } from 'src/constants';

@Injectable()
export class SetlistFMClient {
    constructor(private readonly httpService: HttpService) { }

    headers = {
        "Accept": "application/json",
        "x-api-key": X_API_KEY
    }

    requestConfig: AxiosRequestConfig = {
        headers: this.headers,
    }

    async getSetlistsByArtistName(artistName: String): Promise<string[]> {

        // @TODO - figure out why I can't add query Params this way
        const params = {
            artistName: artistName,
        };

        const requestConfig: AxiosRequestConfig = {
            headers: this.headers,
        }

        try {
            // Setlist.FM automatically shows the most recent shows first.
            const response = await this.httpService.get(SETLIST_FM_BASE_URL + `search/setlists?artistName=${artistName}`, requestConfig).toPromise()
            return response.data.setlist.map(obj => obj.id);
        } catch (error) {
            console.log(error)
        }

    }

    async getSongsBySetlistIds(setlists: string[]): Promise<string[][]> {

        const baseSongBySetlistURL = SETLIST_FM_BASE_URL + "setlist/";
        // Limiting to last 5 due to rate limiting on Setlist.FM
        const urls: string[] = setlists.slice(0, 5).map(i => baseSongBySetlistURL + i)

        try {

            const requests = urls.map(url => this.httpService.get(url, this.requestConfig).toPromise());
            const responses = await
                Promise.all(requests)
                    .then((res) => {
                        return res
                    })
                    .catch((error) => {
                        console.log(error)
                        throw error
                    });
            const sets = responses.map(response => response.data.sets);

            let songs: string[][] = []

            for (let x = 0; x < sets.length; x++) {
                // Get songs from the main set and encores in a single list
                songs.push(sets[x].set.map(i => i.song).flat().map(x => x.name))
            }

            // Pruning empty sets
            return songs.filter((arr) => arr.length > 0);

            // Consider a backoff retry strategy here...
        } catch (error) {
            throw new Error('Failed to fetch data');
        }

    }


}

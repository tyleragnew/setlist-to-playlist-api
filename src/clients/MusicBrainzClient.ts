import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { AxiosRequestConfig } from "axios";

type ArtistMetadata = {
    artistName: string,
    description: string,
    mbid: string
}

@Injectable()
export class MusicBrainzClient {
    constructor(private readonly httpService: HttpService) { }

    headers = {
        Accept: 'application/json',
    };

    requestConfig: AxiosRequestConfig = {
        headers: this.headers,
    };

    async searchForMusicBrainzMetadataByArtistName(artist: string): Promise<ArtistMetadata[]> {

        const response = await this.httpService.get(
            `https://musicbrainz.org/ws/2/artist/?query=${artist}`,
            this.requestConfig).toPromise()

        return response.data.artists.map(artist => ({
            artistName: artist.name,
            description: artist.disambiguation,
            mbid: artist.id
        }));

    }

}
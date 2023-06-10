import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { AxiosRequestConfig } from "axios";

type ArtistMetadata = {
    artistName: string,
    description: string,
    mbid: string
}

const headers = {
    Accept: 'application/json',
};

@Injectable()
export class MusicBrainzClient {
    constructor(private readonly httpService: HttpService) { }


    async searchForMusicBrainzMetadataByArtistName(artist: string): Promise<ArtistMetadata[]> {

        const config: AxiosRequestConfig = {
            method: 'get',
            url: `https://musicbrainz.org/ws/2/artist/?query=${artist}`,
            headers: {
              'Content-Type': 'application/json',
            }
          };

        const response = await this.httpService.get(
            //@ts-ignore
            `https://musicbrainz.org/ws/2/artist/?query=${artist}`, config).toPromise()

        return response.data.artists.map(artist => ({
            artistName: artist.name,
            description: artist.disambiguation,
            mbid: artist.id
        }));

    }

}
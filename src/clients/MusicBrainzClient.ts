import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';

type ArtistMetadata = {
  artistName: string;
  description: string;
  mbid: string;
};

const headers = {
  Accept: 'application/json',
};

@Injectable()
export class MusicBrainzClient {
  constructor(private readonly httpService: HttpService) {}

  async searchForMusicBrainzMetadataByArtistName(
    artist: string,
  ): Promise<ArtistMetadata[]> {
    const headers = {
      'Content-Type': 'application/json',
    };

    const response = await this.httpService
      .get(`https://musicbrainz.org/ws/2/artist/?query=${artist}`, { headers })
      .toPromise();

    return response.data.artists.map((artist) => ({
      artistName: artist.name,
      description: artist.disambiguation,
      mbid: artist.id,
    }));
  }
}

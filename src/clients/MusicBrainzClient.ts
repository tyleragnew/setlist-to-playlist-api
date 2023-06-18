import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

export type ArtistMetadata = {
  artistName: string;
  description: string;
  location: string;
  mbid: string;
};

const headers = {
  Accept: 'application/json',
};

@Injectable()
export class MusicBrainzClient {
  constructor(private readonly httpService: HttpService) { }

  async searchForMusicBrainzMetadataByArtistName(artist: string) {
    const headers = {
      'Content-Type': 'application/json',
    };

    console.log(`Calling MusicBrainz for ${artist}`)

    const response = this.httpService
      .get(`https://musicbrainz.org/ws/2/artist/?query=${artist}`, { headers })
      .pipe();

    return (await lastValueFrom(response)).data.artists.map((artist) => ({
      artistName: artist.name,
      description: artist.disambiguation,
      mbid: artist.id,
      location: artist.area?.name
    }));
  }
}

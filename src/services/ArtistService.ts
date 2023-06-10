import { Injectable } from '@nestjs/common';
import { SpotifyClient } from 'src/clients/SpotifyClient';
import { AverageSetlist } from './SetlistService';
import { MusicBrainzClient } from 'src/clients/MusicBrainzClient';

@Injectable()
export class ArtistService {
  constructor(private readonly musicBrainzClient: MusicBrainzClient) {}

  getArtistIdsByName(artist: string) {
    return this.musicBrainzClient
      .searchForMusicBrainzMetadataByArtistName(artist)
      .then((res) => {
        return res;
      });
  }
}

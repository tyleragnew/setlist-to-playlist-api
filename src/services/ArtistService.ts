import { Injectable } from '@nestjs/common';
import { MusicBrainzClient } from '../clients/MusicBrainzClient';
import { SpotifyClient } from 'src/clients/SpotifyClient';

@Injectable()
export class ArtistService {
  constructor(
    private readonly musicBrainzClient: MusicBrainzClient,
    private readonly spotifyClient: SpotifyClient,
  ) {}

  getArtistImageByName(artist: string, apiKey: string) {
    const spotifyArtistID = this.spotifyClient.getArtistImageByArtistName(
      artist,
      apiKey,
    );
    return spotifyArtistID;
  }

  getArtistIdsByName(artist: string) {
    return this.musicBrainzClient.searchForMusicBrainzMetadataByArtistName(
      artist,
    );
  }
}

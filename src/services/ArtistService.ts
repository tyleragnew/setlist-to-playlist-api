import { Injectable } from '@nestjs/common';
import { MusicBrainzClient } from '../clients/MusicBrainzClient';
import { SpotifyClient } from 'src/clients/SpotifyClient';

export type TopArtistEntry = {
  artistName: string;
  mbid: string;
  imageUrl: string | null;
  currentTour: string | null;
};

@Injectable()
export class ArtistService {
  constructor(
    private readonly musicBrainzClient: MusicBrainzClient,
    private readonly spotifyClient: SpotifyClient,
  ) {}

  getArtistMetadataByName(artist: string, apiKey: string) {
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

  async getTopArtists(apiKey: string): Promise<TopArtistEntry[]> {
    const spotifyArtists = await this.spotifyClient.getTopArtists(apiKey);
    if (!spotifyArtists?.length) return [];

    // Resolve MBIDs in parallel for speed
    const settled = await Promise.allSettled(
      spotifyArtists.map(async (artist) => {
        const mbResults =
          await this.musicBrainzClient.searchForMusicBrainzMetadataByArtistName(
            artist.name,
          );
        const mbMatch = mbResults?.[0];
        if (!mbMatch?.mbid) return null;
        return {
          artistName: artist.name,
          mbid: mbMatch.mbid,
          imageUrl: artist.imageUrl,
          currentTour: null,
        } as TopArtistEntry;
      }),
    );

    return settled
      .filter(
        (r): r is PromiseFulfilledResult<TopArtistEntry> =>
          r.status === 'fulfilled' && r.value != null,
      )
      .map((r) => r.value);
  }
}

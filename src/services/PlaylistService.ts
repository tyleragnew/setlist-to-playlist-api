import { Injectable } from '@nestjs/common';
import { PlaylistMetadata, SpotifyClient } from 'src/clients/SpotifyClient';
import { AverageSetlist } from './SetlistService';

@Injectable()
export class PlaylistService {
  constructor(private readonly spotifyClient: SpotifyClient) {}

  async getUserIdFrom(apiKey: string) {
    const res = await this.spotifyClient.getUserIdByApiKey(apiKey);
    return res;
  }

  async putTogetherPlaylistDraftFromAverageSetlist(
    averageSetlist: AverageSetlist,
    apiKey: string,
  ) {
    const res = await this.spotifyClient.getTrackIdsbyArtistNameAndTrackNames(
      averageSetlist,
      apiKey,
    );
    return res;
  }

  async makePlaylist(userId, playlistMetadata, apiKey) {
    const res = await this.spotifyClient.createPlaylist(
      userId,
      playlistMetadata,
      apiKey,
    );
    return res;
  }
}

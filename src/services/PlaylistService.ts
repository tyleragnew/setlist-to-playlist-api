import { Injectable } from '@nestjs/common';
import { PlaylistMetadata, SpotifyClient } from 'src/clients/SpotifyClient';
import { AverageSetlist } from './SetlistService';

@Injectable()
export class PlaylistService {
  constructor(private readonly spotifyClient: SpotifyClient) {}

  async putTogetherPlaylistDraftFromAverageSetlist(
    averageSetlist: AverageSetlist,
  ) {
    const res = await this.spotifyClient.getTrackIdsbyArtistNameAndTrackNames(
      averageSetlist,
    );
    return res;
  }

  async makePlaylist(userId, playlistMetadata) {
    const res = await this.spotifyClient.createPlaylist(
      userId,
      playlistMetadata,
    );
    return res;
  }
}

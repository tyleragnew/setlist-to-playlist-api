import { Injectable } from '@nestjs/common';
import { PlaylistMetadata, SpotifyClient } from 'src/clients/SpotifyClient';
import { AverageSetlist } from './SetlistService';

@Injectable()
export class PlaylistService {
  constructor(private readonly spotifyClient: SpotifyClient) {}

  putTogetherPlaylistDraftFromAverageSetlist(averageSetlist: AverageSetlist) {
    return this.spotifyClient
      .getTrackIdsbyArtistNameAndTrackNames(averageSetlist)
      .then((res) => {
        return res;
      });
  }

  makePlaylist(userId, playlistMetadata) {
    return this.spotifyClient
      .createPlaylist(userId, playlistMetadata)
      .then((res) => {
        return res;
      });
  }
}

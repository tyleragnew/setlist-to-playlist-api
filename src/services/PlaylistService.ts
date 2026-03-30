import { Injectable } from '@nestjs/common';
import { SpotifyClient } from '../clients/SpotifyClient';
import { AverageSetlist } from './SetlistService';
import { CoverImageService } from './CoverImageService';

@Injectable()
export class PlaylistService {
  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly coverImageService: CoverImageService,
  ) {}

  async getUserIdFrom(apiKey: string) {
    const res = await this.spotifyClient.getUserIdByApiKey(apiKey);
    return res;
  }

  async putTogetherPlaylistDraftFromAverageSetlist(
    averageSetlist: AverageSetlist,
    apiKey: string,
  ) {
    const res = await this.spotifyClient.getTrackIdsbyArtistNameAndTrackName(
      averageSetlist,
      apiKey,
    );
    return res;
  }

  async makePlaylist(
    userId,
    playlistMetadata,
    apiKey,
    artistImageUrl?: string,
  ) {
    const res = await this.spotifyClient.createPlaylist(
      userId,
      playlistMetadata,
      apiKey,
    );

    // Generate and upload cover image (non-blocking, non-fatal)
    if (res?.playlistId) {
      try {
        const base64Image = await this.coverImageService.generateCoverImage(
          playlistMetadata.artistName,
          artistImageUrl,
        );
        await this.spotifyClient.uploadPlaylistCover(
          res.playlistId,
          base64Image,
          apiKey,
        );
      } catch (error) {
        console.error(
          'Cover image generation/upload failed:',
          error instanceof Error ? error.stack : error,
        );
      }
    }

    return res;
  }
}

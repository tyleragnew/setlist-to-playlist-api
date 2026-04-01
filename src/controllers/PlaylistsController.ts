import {
  Controller,
  Headers,
  Body,
  Post,
  BadRequestException,
} from '@nestjs/common';
import { PlaylistService } from '../services/PlaylistService';
import { ServiceAccountTokenManager } from '../services/ServiceAccountTokenManager';

@Controller('playlists')
export class PlaylistController {
  constructor(
    private readonly playlistService: PlaylistService,
    private readonly serviceAccountTokenManager: ServiceAccountTokenManager,
  ) {}

  @Post()
  async createPlaylist(
    @Body() requestBody: any,
    @Headers() headers: Record<string, string>,
  ) {
    const userToken = headers['api-key'];

    // Guest mode: use service account token when no user token provided
    const apiKey =
      userToken || (await this.serviceAccountTokenManager.getAccessToken());
    const isGuest = !userToken;

    const userId = await this.playlistService.getUserIdFrom(apiKey);

    const playlistMetadata =
      await this.playlistService.putTogetherPlaylistDraftFromAverageSetlist(
        requestBody,
        apiKey,
      );

    if (!playlistMetadata?.mappedSongs?.length) {
      console.error(
        JSON.stringify({
          event: 'playlist_failed',
          reason: 'no_tracks_matched',
          artist: requestBody.artistName,
          songsRequested: requestBody.songs?.length ?? 0,
          isGuest,
        }),
      );
      throw new BadRequestException(
        'No tracks could be found on Spotify for this setlist.',
      );
    }

    const result = await this.playlistService.makePlaylist(
      userId,
      {
        ...playlistMetadata,
        playlistDescription: requestBody.playlistDescription,
      },
      apiKey,
      requestBody.artistImageUrl,
    );

    console.log(
      JSON.stringify({
        event: 'playlist_created',
        artist: requestBody.artistName,
        trackCount: result.trackCount,
        unmappedCount: result.unmappedSongs?.length ?? 0,
        isGuest,
      }),
    );

    return { ...result, isGuest };
  }
}

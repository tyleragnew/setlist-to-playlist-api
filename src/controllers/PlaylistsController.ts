import { Controller, Headers, Body, Post } from '@nestjs/common';
import { PlaylistService } from '../services/PlaylistService';

@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlistService: PlaylistService) {}

  @Post()
  async createPlaylist(
    @Body() requestBody: any,
    @Headers() headers: Record<string, string>,
  ) {
    const apiKey = headers['api-key'];

    const userId = await this.playlistService
      .getUserIdFrom(apiKey)
      .then((res) => {
        return res;
      });

    const playlistMetadata = await this.playlistService
      .putTogetherPlaylistDraftFromAverageSetlist(requestBody, apiKey)
      .then((res) => {
        return res;
      });

    return this.playlistService.makePlaylist(userId, playlistMetadata, apiKey);
  }
}

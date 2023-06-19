import { Controller, Query, Headers, Body, Post } from '@nestjs/common';
import { PlaylistService } from 'src/services/PlaylistService';
import { AverageSetlist } from 'src/services/SetlistService';

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

    // @TODO - surface this draft data? Or just let it rip?
    const playlistMetadata = await this.playlistService
      .putTogetherPlaylistDraftFromAverageSetlist(requestBody, apiKey)
      .then((res) => {
        return res;
      });

    return this.playlistService.makePlaylist(userId, playlistMetadata, apiKey);
  }
}

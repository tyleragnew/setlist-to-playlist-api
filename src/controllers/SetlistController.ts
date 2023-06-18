import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ArtistService } from 'src/services/ArtistService';
import { PlaylistService } from 'src/services/PlaylistService';
import { SetlistService } from 'src/services/SetlistService';

@Controller('setlists')
export class SetlistsController {
  constructor(
    private readonly setlistService: SetlistService,
    private readonly playlistService: PlaylistService,
  ) { }

  @Get()
  async findSetlistsByMBID(
    @Headers() headers: Record<string, string>,
    @Query('artistMBID') artistMBID: string,
    @Query('numberOfSets') numberOfSets: number,
    @Query('userId') userId: string,
  ) {
    /* @TODO
      Right now this is in the Setlist Controller for e2e testing purposes,
      but will need to be moved into the Playlist controller.
      This is why there is promise resolution in the Controller.
    */

    const apiKey = headers['api-key'];

    const totalSetlistMetadata = await this.setlistService
      .getAverageSetlistByArtistName(artistMBID, numberOfSets)
      .then((res) => {
        return res;
      });

    const playlistMetadata = await this.playlistService
      .putTogetherPlaylistDraftFromAverageSetlist(totalSetlistMetadata, apiKey)
      .then((res) => {
        return res;
      });

    return this.playlistService.makePlaylist(userId, playlistMetadata, apiKey);
  }
}

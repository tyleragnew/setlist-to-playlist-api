import { Controller, Get, Query } from '@nestjs/common';
import { ArtistService } from 'src/services/ArtistService';
import { PlaylistService } from 'src/services/PlaylistService';
import { SetlistService } from 'src/services/SetlistService';

@Controller('setlists')
export class SetlistsController {
  constructor(
    private readonly setlistService: SetlistService,
    private readonly playlistService: PlaylistService,
  ) {}

  @Get()
  async findSetlistsByMBID(
    @Query('artistMBID') artistMBID: string,
    @Query('numberOfSets') numberOfSets: number,
    @Query('userId') userId: string,
  ) {
    const totalSetlistMetadata = await this.setlistService
      .getAverageSetlistByArtistName(artistMBID, numberOfSets)
      .then((res) => {
        return res;
      });

    const playlistMetadata = await this.playlistService
      .putTogetherPlaylistDraftFromAverageSetlist(totalSetlistMetadata)
      .then((res) => {
        return res;
      });

    return this.playlistService.makePlaylist(userId, playlistMetadata);
  }
}

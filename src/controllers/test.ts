import { Controller, Get, Query } from '@nestjs/common';
import { PlaylistService } from 'src/services/PlaylistService';
import { SetlistService } from 'src/services/SetlistService';

@Controller('artists')
export class ArtistsController {
  constructor(
    private readonly setlistService: SetlistService,
    private readonly playlistService: PlaylistService,
  ) {}

  @Get()
  async findArtist(
    @Query('artistName') artistName,
    @Query('numberOfSets') numberOfSets,
  ) {
    const setlistMetadata = await this.setlistService
      .getAverageSetlistByArtistName(artistName, numberOfSets)
      .then((res) => {
        return res;
      });
    return this.playlistService.getPlaylist(setlistMetadata);
  }
}

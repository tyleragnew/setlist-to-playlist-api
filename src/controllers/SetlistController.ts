import { Controller, Get, Query } from '@nestjs/common';
import { SetlistService } from '../services/SetlistService';

@Controller('setlists')
export class SetlistsController {
  constructor(private readonly setlistService: SetlistService) {}

  @Get()
  async findSetlistsByMBID(
    @Query('artistMBID') artistMBID: string,
    @Query('numberOfSets') numberOfSets: number,
    @Query('allSongs') allSongs?: string,
  ) {
    return await this.setlistService
      .getAverageSetlistByArtistName(
        artistMBID,
        numberOfSets,
        allSongs === 'true',
      )
      .then((res) => {
        return res;
      });
  }

  @Get('meta')
  async getArtistShowMeta(@Query('artistMBID') artistMBID: string) {
    return await this.setlistService.getArtistShowMeta(artistMBID);
  }
}

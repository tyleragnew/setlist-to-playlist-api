import { Controller, Get, Query } from '@nestjs/common';
import { SearchMode, SetlistService } from '../services/SetlistService';

@Controller('setlists')
export class SetlistsController {
  constructor(private readonly setlistService: SetlistService) {}

  @Get()
  async findSetlistsByMBID(
    @Query('artistMBID') artistMBID: string,
    @Query('mode') mode?: string,
    @Query('numberOfSets') numberOfSets?: string,
    @Query('allSongs') allSongs?: string,
    @Query('tourName') tourName?: string,
    @Query('year') year?: string,
  ) {
    let searchMode: SearchMode;

    switch (mode) {
      case 'tour':
        searchMode = { mode: 'tour', tourName: tourName ?? '' };
        break;
      case 'year':
        searchMode = { mode: 'year', year: Number(year) };
        break;
      default:
        searchMode = {
          mode: 'recent',
          numberOfSets: Number(numberOfSets) || 10,
        };
        break;
    }

    return await this.setlistService.getAverageSetlist(
      artistMBID,
      searchMode,
      allSongs === 'true',
    );
  }

  @Get('meta')
  async getArtistShowMeta(@Query('artistMBID') artistMBID: string) {
    return await this.setlistService.getArtistShowMeta(artistMBID);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { SetlistService } from '../services/SetlistService';

@Controller('setlists')
export class SetlistsController {
  constructor(private readonly setlistService: SetlistService) {}

  @Get()
  async findSetlistsByMBID(
    @Query('artistMBID') artistMBID: string,
    @Query('numberOfSets') numberOfSets: number,
  ) {
    return await this.setlistService
      .getAverageSetlistByArtistName(artistMBID, numberOfSets)
      .then((res) => {
        return res;
      });
  }
}

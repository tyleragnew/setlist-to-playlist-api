import { Controller, Get, Query } from '@nestjs/common';
import { ArtistService } from 'src/services/ArtistService';
import { PlaylistService } from 'src/services/PlaylistService';
import { SetlistService } from 'src/services/SetlistService';

@Controller('artists')
export class ArtistsController {
  constructor(
    private readonly artistService: ArtistService,
  ) { }

  /* This endpoint will be used by the frontend to bring back artists that the 
  end-user can choose from. By coalescing around an MBID, we are much more likely
  to get an exact match on artist. Example searches that haven't worked direct to
  Setlist.FM are "Genesis"
  */

  @Get()
  getArtistIdsByName(
    @Query('artist') artist: string
  ) {
    return this.artistService.getArtistIdsByName(artist)
  }

}

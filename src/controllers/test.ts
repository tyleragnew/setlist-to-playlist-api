import { Controller, Get, Query } from '@nestjs/common';
import { SetlistService } from 'src/services/SetlistService';

@Controller("artists")
export class ArtistsController {
    constructor(private readonly setlistService: SetlistService) { }

    @Get()
    findArtist(@Query('artistName') artistName): any {
        return this.setlistService.getAverageSetlistByArtistName(artistName)
    }

}

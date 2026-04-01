import { Controller, Get, Query, Headers } from '@nestjs/common';
import { ArtistService } from '../services/ArtistService';
import { ServiceAccountTokenManager } from '../services/ServiceAccountTokenManager';

@Controller('artists')
export class ArtistController {
  constructor(
    private readonly artistService: ArtistService,
    private readonly serviceAccountTokenManager: ServiceAccountTokenManager,
  ) {}

  @Get()
  getArtistIdsByName(@Query('artist') artist: string) {
    return this.artistService.getArtistIdsByName(artist);
  }

  @Get('image')
  async getArtistMetadataByName(
    @Query('artist') artist: string,
    @Headers() headers: Record<string, string>,
  ) {
    const apiKey =
      headers['api-key'] ||
      (await this.serviceAccountTokenManager.getAccessToken());
    return this.artistService.getArtistMetadataByName(artist, apiKey);
  }

  @Get('top')
  async getTopArtists(@Headers() headers: Record<string, string>) {
    const apiKey = headers['api-key'];
    // Top artists only works for authenticated users
    if (!apiKey) return [];
    return this.artistService.getTopArtists(apiKey);
  }
}

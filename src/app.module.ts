import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { ArtistsController } from './controllers/ArtistsController';
import { SetlistService } from './services/SetlistService';
import { SetlistFMClient } from './clients/SetlistFMClient';
import { PlaylistService } from './services/PlaylistService';
import { SpotifyClient } from './clients/SpotifyClient';
import { MusicBrainzClient } from './clients/MusicBrainzClient';
import { ArtistService } from './services/ArtistService';
import { SetlistsController } from './controllers/SetlistController';

@Module({
  imports: [HttpModule],
  controllers: [ArtistsController, SetlistsController],
  providers: [
    AppService,
    ArtistService,
    SetlistService,
    SetlistFMClient,
    MusicBrainzClient,
    PlaylistService,
    SpotifyClient,
  ],
})
export class AppModule { }

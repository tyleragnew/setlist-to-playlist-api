import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArtistsController } from './controllers/test';
import { SetlistService } from './services/SetlistService';
import { SetlistFMClient } from './clients/SetlistFMClient';
import { PlaylistService } from './services/PlaylistService';
import { SpotifyClient } from './clients/SpotifyClient';

@Module({
  imports: [HttpModule],
  controllers: [AppController, ArtistsController],
  providers: [
    AppService,
    SetlistService,
    SetlistFMClient,
    PlaylistService,
    SpotifyClient
  ],
})
export class AppModule { }

import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AppService } from './app.service';

// Controllers
import { ArtistController } from './controllers/ArtistController';
import { PlaylistController } from './controllers/PlaylistsController';
import { SetlistsController } from './controllers/SetlistController';

// Services
import { ArtistService } from './services/ArtistService';
import { PlaylistService } from './services/PlaylistService';
import { SetlistService } from './services/SetlistService';

// Clients
import { MusicBrainzClient } from './clients/MusicBrainzClient';
import { SetlistFMClient } from './clients/SetlistFMClient';
import { SpotifyClient } from './clients/SpotifyClient';

@Module({
  imports: [HttpModule],
  controllers: [ArtistController, PlaylistController, SetlistsController],
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

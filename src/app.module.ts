import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppService } from './app.service';

// Controllers
import { ArtistController } from './controllers/ArtistController';
import { PlaylistController } from './controllers/PlaylistsController';
import { SetlistsController } from './controllers/SetlistController';

// Services
import { ArtistService } from './services/ArtistService';
import { CoverImageService } from './services/CoverImageService';
import { PlaylistService } from './services/PlaylistService';
import { SetlistService } from './services/SetlistService';

// Clients
import { MusicBrainzClient } from './clients/MusicBrainzClient';
import { SetlistFMClient } from './clients/SetlistFMClient';
import { SpotifyClient } from './clients/SpotifyClient';
import { HealthController } from './controllers/HealthController';
import { ServiceAccountTokenManager } from './services/ServiceAccountTokenManager';

@Module({
  imports: [
    HttpModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 20,
      },
    ]),
  ],
  controllers: [
    ArtistController,
    PlaylistController,
    SetlistsController,
    HealthController,
  ],
  providers: [
    AppService,
    ArtistService,
    CoverImageService,
    SetlistService,
    SetlistFMClient,
    MusicBrainzClient,
    PlaylistService,
    SpotifyClient,
    ServiceAccountTokenManager,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

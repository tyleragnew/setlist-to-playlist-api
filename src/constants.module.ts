import { Module } from '@nestjs/common';
import {
  X_API_KEY,
  SETLIST_FM_BASE_URL,
  SPOTIFY_AUTHORIZATION_BEARER_TOKEN,
  SPOTIFY_BASE_URL,
} from './constants';

@Module({
  providers: [
    {
      provide: 'X_API_KEY',
      useValue: X_API_KEY,
    },
    {
      provide: 'SETLIST_FM_BASE_URL',
      useValue: SETLIST_FM_BASE_URL,
    },
    {
      provide: 'SPOTIFY_AUTHORIZATION_BEARER_TOKEN',
      useValue: SPOTIFY_AUTHORIZATION_BEARER_TOKEN,
    },
    {
      provide: 'SPOTIFY_BASE_URL',
      useValue: SPOTIFY_BASE_URL,
    },
  ],
  exports: [
    'X_API_KEY',
    'SETLIST_FM_BASE_URL',
    'SPOTIFY_AUTHORIZATION_BEARER_TOKEN',
    'SPOTIFY_BASE_URL',
  ],
})
export class ConstantsModule {}

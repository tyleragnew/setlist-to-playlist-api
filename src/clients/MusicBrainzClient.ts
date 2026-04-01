import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

export type ArtistMetadata = {
  artistName: string;
  description: string;
  location: string;
  mbid: string;
};

@Injectable()
export class MusicBrainzClient {
  private readonly logger = new Logger(MusicBrainzClient.name);

  constructor(private readonly httpService: HttpService) {}

  async searchForMusicBrainzMetadataByArtistName(artist: string) {
    const headers = {
      'Content-Type': 'application/json',
    };

    this.logger.log(`Searching for Artist: ${artist}`);

    try {
      const response = this.httpService
        .get(`https://musicbrainz.org/ws/2/artist/?query=${artist}`, {
          headers,
        })
        .pipe();

      return (await lastValueFrom(response)).data.artists.map((artist) => ({
        artistName: this.normalizeUnicode(artist.name),
        description: artist.disambiguation,
        mbid: artist.id,
        location: artist.area?.name,
        imageURL: artist.imageURL,
      }));
    } catch (error) {
      this.logger.error(
        `Unable to call MusicBrainz for artist: ${artist}`,
        error,
      );
    }
  }

  /** Replace Unicode hyphens, dashes, and special punctuation with ASCII equivalents */
  private normalizeUnicode(str: string): string {
    return str
      .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\uFE58\uFE63\uFF0D]/g, '-')
      .replace(/[\u2018\u2019\u201A\uFF07]/g, "'")
      .replace(/[\u201C\u201D\u201E\uFF02]/g, '"');
  }
}

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { error } from 'console';
import { response } from 'express';
import {
  SPOTIFY_AUTHORIZATION_BEARER_TOKEN,
  SPOTIFY_BASE_URL,
} from 'src/constants';
import { AverageSetlist } from 'src/services/SetlistService';

type MappedSongMetadata = {
  songTitle: string;
  spotifySongId: string;
};

type PlaylistMetadata = {
  mappedSongsMetadata: MappedSongMetadata[];
  unmappedSongs: string[];
};

@Injectable()
export class SpotifyClient {
  constructor(private readonly httpService: HttpService) {}

  //Get TrackID's by Artist Name and Track Names
  async getTrackIdsbyArtistNameAndTrackNames(
    averageSetlist: AverageSetlist,
  ): Promise<PlaylistMetadata> {
    try {
      const headers = {
        Authorization: `Bearer ${SPOTIFY_AUTHORIZATION_BEARER_TOKEN}`,
      };

      const requestConfig: AxiosRequestConfig = {
        headers,
      };

      const requests = averageSetlist.songs.map((song) =>
        this.httpService
          .get(this.generateURL(song, averageSetlist.artistName), requestConfig)
          .toPromise(),
      );

      const foundTracks: MappedSongMetadata[] = [];
      const unfoundTracks: string[] = [];

      try {
        const responses = await Promise.all(requests);
        responses.forEach((response) => {
          const track = response.data.tracks.items[0];
          if (track != null) {
            console.log(response.data.tracks.href);
            const trackMetadata: MappedSongMetadata = {
              songTitle: track.name,
              spotifySongId: track.id,
            };
            foundTracks.push(trackMetadata);
          } else {
            // @TODO - Add a friendly name to unmapped songs
            unfoundTracks.push(response.data.tracks.href);
          }
        });

        return {
          mappedSongsMetadata: foundTracks,
          unmappedSongs: unfoundTracks,
        };
      } catch (error) {
        console.log(error);
        return error;
      }
    } catch (error) {
      console.log(error);
    }
  }

  generateURL(songTitle, artistTitle) {
    const url = `https://api.spotify.com/v1/search?q=track:${songTitle.replace(
      / /g,
      '+',
    )} artist:${artistTitle.replace(/ /g, '+')}&type=track&offset=0&limit=1`;
    return url;
  }
}

import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosError } from 'axios';
import { SPOTIFY_BASE_URL } from '../constants';
import { AverageSetlist, SongEntry } from '../services/SetlistService';
import { lastValueFrom } from 'rxjs';

type MappedSongMetadata = {
  songTitle: string;
  spotifySongId: string;
};

export type PlaylistMetadata = {
  artistName: string;
  mappedSongs: MappedSongMetadata[];
  unmappedSongs: string[];
};

@Injectable()
export class SpotifyClient {
  constructor(private readonly httpService: HttpService) {}

  private handleRequestError(error: unknown, context: string) {
    // Log useful debug information
    if ((error as AxiosError).isAxiosError) {
      const axiosErr = error as AxiosError;
      console.error(`${context} - AxiosError:`, {
        message: axiosErr.message,
        url: axiosErr.config?.url,
        method: axiosErr.config?.method,
        status: axiosErr.response?.status,
        data: axiosErr.response?.data,
      });
      const status = axiosErr.response?.status || HttpStatus.BAD_GATEWAY;
      const message = axiosErr.response?.data || axiosErr.message;
      // Provide clearer guidance for 401s from Spotify
      if (status === HttpStatus.UNAUTHORIZED) {
        console.error(
          `${context} - 401 Unauthorized from Spotify. Common causes: expired/invalid access token, using client-credentials token for user endpoints, or missing scopes (e.g. playlist-modify-public).`,
        );
        throw new HttpException(
          {
            error: 'Unauthorized: invalid or expired Spotify access token',
            details: message,
            hint: 'Ensure you pass a valid OAuth access token (Authorization Code flow) with required scopes (e.g. playlist-modify-public) and not a client-credentials token. Tokens expire after ~1 hour and must be refreshed.',
          },
          HttpStatus.UNAUTHORIZED,
        );
      }

      throw new HttpException({ error: message }, status);
    }

    // Unknown error
    console.error(`${context} - Unknown error:`, error);
    throw new HttpException(
      'Internal Server Error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  private normalizeToken(apiKey: string) {
    if (!apiKey) return apiKey;
    return apiKey.replace(/^Bearer\s+/i, '').trim();
  }

  async getUserIdByApiKey(apiKey: string): Promise<string> {
    const token = this.normalizeToken(apiKey);
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    try {
      const response = await this.httpService
        .get(`https://api.spotify.com/v1/me`, { headers })
        .toPromise();
      return response.data.id;
    } catch (error) {
      this.handleRequestError(error, 'getUserIdByApiKey');
    }
  }

  async getArtistIdByName(
    artistName: string,
    apiKey: string,
  ): Promise<string | null> {
    const token = this.normalizeToken(apiKey);
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    try {
      const response = await lastValueFrom(
        this.httpService.get(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
          { headers },
        ),
      );
      return response.data.artists.items[0]?.id ?? null;
    } catch (error) {
      this.handleRequestError(error, 'getArtistIdByName');
    }
  }

  /*
    Get Spotify TrackID's
    by resolving the Artist ID, then searching tracks and
    verifying results belong to the correct artist.
  */
  async getTrackIdsbyArtistNameAndTrackName(
    averageSetlist: AverageSetlist,
    apiKey: string,
  ): Promise<PlaylistMetadata> {
    const token = this.normalizeToken(apiKey);
    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      // Separate songs into main artist songs and cover songs (tape covers)
      const mainSongs: { song: SongEntry; idx: number }[] = [];
      const coverSongs: { song: SongEntry; idx: number }[] = [];

      averageSetlist.songs.forEach((song, idx) => {
        if (song.coverArtist) {
          coverSongs.push({ song, idx });
        } else {
          mainSongs.push({ song, idx });
        }
      });

      // Search for main artist songs
      const mainRequests = mainSongs.map(({ song }) =>
        this.httpService
          .get(
            this.generateSpotifyTrackURL(song.title, averageSetlist.artistName),
            { headers },
          )
          .toPromise(),
      );

      // Search for cover songs using the original artist
      const coverRequests = coverSongs.map(({ song }) =>
        this.httpService
          .get(
            this.generateSpotifyTrackURL(song.title, song.coverArtist),
            { headers },
          )
          .toPromise(),
      );

      const foundTracks: MappedSongMetadata[] = [];
      const unfoundTracks: string[] = [];

      console.log(
        `Searching Spotify tracks for artist "${averageSetlist.artistName}"` +
          (coverSongs.length
            ? ` (${coverSongs.length} tape cover(s) will use original artist)`
            : ''),
      );

      const [mainResponses, coverResponses] = await Promise.all([
        Promise.all(mainRequests),
        Promise.all(coverRequests),
      ]);

      // Collect all Spotify artist IDs that appear in results for the main artist,
      // then use the most frequent one to verify matches
      const artistIdCounts = new Map<string, number>();
      mainResponses.forEach((response) => {
        for (const item of response.data.tracks.items) {
          for (const a of item.artists) {
            if (
              a.name.toLowerCase() === averageSetlist.artistName.toLowerCase()
            ) {
              artistIdCounts.set(a.id, (artistIdCounts.get(a.id) || 0) + 1);
            }
          }
        }
      });

      // The most common artist ID across all results is the correct one
      let artistId: string | null = null;
      let maxCount = 0;
      for (const [id, count] of artistIdCounts) {
        if (count > maxCount) {
          artistId = id;
          maxCount = count;
        }
      }

      console.log(
        `Resolved Spotify artist ID: ${artistId} (appeared ${maxCount} times across results)`,
      );

      // Build results array in original order
      const results: { items: any[]; song: SongEntry }[] = new Array(
        averageSetlist.songs.length,
      );

      mainSongs.forEach(({ idx, song }, i) => {
        results[idx] = { items: mainResponses[i].data.tracks.items, song };
      });
      coverSongs.forEach(({ idx, song }, i) => {
        results[idx] = { items: coverResponses[i].data.tracks.items, song };
      });

      results.forEach(({ items, song }) => {
        let track;
        if (song.coverArtist) {
          // For covers, just take the first result (searched by original artist already)
          track = items[0];
        } else {
          // For main artist songs, verify against resolved artist ID
          track = artistId
            ? items.find((item) =>
                item.artists.some((a) => a.id === artistId),
              )
            : items[0];
        }

        if (track != null) {
          foundTracks.push({
            songTitle: track.name,
            spotifySongId: track.id,
          });
        } else {
          console.log(
            `[UNMAPPED] "${song.title}"${song.coverArtist ? ` (cover of ${song.coverArtist})` : ''} - ${items.length} results`,
          );
          unfoundTracks.push(song.title);
        }
      });

      return {
        artistName: averageSetlist.artistName,
        mappedSongs: foundTracks,
        unmappedSongs: unfoundTracks,
      };
    } catch (error) {
      this.handleRequestError(error, 'getTrackIdsbyArtistNameAndTrackName');
    }
  }

  generateSpotifyTrackURL(songTitle: string, artistName: string) {
    const encodedTrack = encodeURIComponent(songTitle);
    const encodedArtist = encodeURIComponent(artistName);
    return `${SPOTIFY_BASE_URL}?q=track:${encodedTrack}+artist:${encodedArtist}&type=track&offset=0&limit=5`;
  }

  async createPlaylist(
    userId,
    playlistMetadata: PlaylistMetadata,
    apiKey: string,
  ) {
    const token = this.normalizeToken(apiKey);
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    try {
      const createPlaylistRequestBody = {
        name: `${playlistMetadata.artistName} Setlist`,
        description: `A representative setlist for ${playlistMetadata.artistName}. Generated by Setlist2Playlist App`,
        public: true,
      };

      console.log(`Creating Playlist for ${playlistMetadata.artistName}`);
      const createPlaylistResponse = await this.httpService
        .post(
          `https://api.spotify.com/v1/users/${userId}/playlists`,
          createPlaylistRequestBody,
          { headers },
        )
        .toPromise();

      const playlistId = createPlaylistResponse.data.id;

      const trackData = {
        uris: playlistMetadata.mappedSongs.map(
          (song) => `spotify:track:${song.spotifySongId}`,
        ),
      };

      await this.httpService
        .put(
          `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
          trackData,
          { headers },
        )
        .toPromise();

      const response = {
        playlistId: playlistId,
        embedURL: `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`,
        unmappedSongs: playlistMetadata.unmappedSongs,
      };

      return response;
    } catch (error) {
      this.handleRequestError(error, 'createPlaylist');
    }
  }

  getArtistImageByArtistName(artistName: string, apiKey: string) {
    const token = this.normalizeToken(apiKey);
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    return lastValueFrom(
      this.httpService.get(
        `https://api.spotify.com/v1/search?q=${artistName}&type=artist`,
        { headers },
      ),
    ).then((response) => {
      const artistImageURL = response.data.artists.items[0]?.images[0]?.url;
      return artistImageURL;
    });
  }
}

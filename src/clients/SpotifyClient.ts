import { HttpService } from '@nestjs/axios';
import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
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
  playlistDescription?: string;
};

@Injectable()
export class SpotifyClient {
  private readonly logger = new Logger(SpotifyClient.name);

  constructor(private readonly httpService: HttpService) {}

  private handleRequestError(error: unknown, context: string) {
    // Log useful debug information
    if ((error as AxiosError).isAxiosError) {
      const axiosErr = error as AxiosError;
      this.logger.error(`${context} - AxiosError:`, {
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
        this.logger.error(
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
    this.logger.error(`${context} - Unknown error:`, error);
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
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(
            artistName,
          )}&type=artist&limit=1`,
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

      // Search ALL songs by the chosen artist first
      const allRequests = averageSetlist.songs.map((song) =>
        this.httpService
          .get(
            this.generateSpotifyTrackURL(song.title, averageSetlist.artistName),
            { headers },
          )
          .toPromise(),
      );

      const foundTracks: MappedSongMetadata[] = [];
      const unfoundTracks: string[] = [];

      this.logger.log(
        `Searching Spotify tracks for artist "${averageSetlist.artistName}"` +
          (coverSongs.length
            ? ` (${coverSongs.length} cover(s) will fall back to original artist if needed)`
            : ''),
      );

      const allResponses = await Promise.all(allRequests);

      // Collect all Spotify artist IDs that appear in results for the main artist,
      // then use the most frequent one to verify matches
      const artistIdCounts = new Map<string, number>();
      allResponses.forEach((response) => {
        for (const item of response.data.tracks.items) {
          for (const a of item.artists) {
            if (
              this.normalizeArtistName(a.name) ===
              this.normalizeArtistName(averageSetlist.artistName)
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

      // If strict search found nothing, retry with loose search
      if (!artistId) {
        this.logger.log(
          `No results with strict search for "${averageSetlist.artistName}", retrying with loose search`,
        );
        const looseRequests = averageSetlist.songs.map((song) =>
          this.httpService
            .get(
              this.generateSpotifyTrackURL(
                song.title,
                averageSetlist.artistName,
                true,
              ),
              { headers },
            )
            .toPromise(),
        );
        const looseResponses = await Promise.all(looseRequests);
        looseResponses.forEach((response, idx) => {
          allResponses[idx] = response;
        });

        // Re-resolve artist ID from loose results
        artistIdCounts.clear();
        allResponses.forEach((response) => {
          for (const item of response.data.tracks.items) {
            for (const a of item.artists) {
              if (
                this.normalizeArtistName(a.name) ===
                this.normalizeArtistName(averageSetlist.artistName)
              ) {
                artistIdCounts.set(a.id, (artistIdCounts.get(a.id) || 0) + 1);
              }
            }
          }
        });
        maxCount = 0;
        for (const [id, count] of artistIdCounts) {
          if (count > maxCount) {
            artistId = id;
            maxCount = count;
          }
        }
      }

      this.logger.log(
        `Resolved Spotify artist ID: ${artistId} (appeared ${maxCount} times across results)`,
      );

      // For cover songs that didn't match the chosen artist, fall back to original artist
      const coverFallbackIndices: number[] = [];
      const coverFallbackRequests: Promise<any>[] = [];

      coverSongs.forEach(({ idx, song }) => {
        const items = allResponses[idx].data.tracks.items;
        // Check if the chosen artist actually has this track
        // Use artist ID if resolved, otherwise match by name
        const match = artistId
          ? items.find((item: any) =>
              item.artists.some((a: any) => a.id === artistId),
            )
          : items.find((item: any) =>
              item.artists.some(
                (a: any) =>
                  a.name.toLowerCase() ===
                  averageSetlist.artistName.toLowerCase(),
              ),
            );
        if (!match) {
          this.logger.log(
            `[COVER FALLBACK] "${song.title}" not found for ${averageSetlist.artistName}, trying ${song.coverArtist}`,
          );
          coverFallbackIndices.push(idx);
          coverFallbackRequests.push(
            this.httpService
              .get(this.generateSpotifyTrackURL(song.title, song.coverArtist), {
                headers,
              })
              .toPromise(),
          );
        }
      });

      const coverFallbackResponses = coverFallbackRequests.length
        ? await Promise.all(coverFallbackRequests)
        : [];

      // Merge fallback results into allResponses
      coverFallbackIndices.forEach((idx, i) => {
        allResponses[idx] = coverFallbackResponses[i];
      });

      // If preferLive is enabled, search for live versions of each song
      let liveTrackMap: Map<number, any> | null = null;
      if (averageSetlist.preferLive) {
        this.logger.log('Prefer Live enabled — searching for live versions');
        const liveRequests = averageSetlist.songs.map((song) =>
          this.httpService
            .get(
              this.generateSpotifyTrackURL(
                `${song.title} live`,
                song.coverArtist || averageSetlist.artistName,
              ),
              { headers },
            )
            .toPromise(),
        );
        const liveResponses = await Promise.all(liveRequests);
        liveTrackMap = new Map();
        liveResponses.forEach((response, idx) => {
          const items = response.data.tracks.items;
          const matchArtistId = coverFallbackIndices.includes(idx)
            ? null
            : artistId;
          const liveTrack = matchArtistId
            ? items.find(
                (item: any) =>
                  item.artists.some((a: any) => a.id === matchArtistId) &&
                  /\blive\b/i.test(item.name),
              )
            : items.find(
                (item: any) =>
                  /\blive\b/i.test(item.name),
              );
          if (liveTrack) {
            liveTrackMap.set(idx, liveTrack);
          }
        });
        this.logger.log(
          `Found live versions for ${liveTrackMap.size} of ${averageSetlist.songs.length} songs`,
        );
      }

      // Build final results
      averageSetlist.songs.forEach((song, idx) => {
        const items = allResponses[idx].data.tracks.items;
        let track;

        if (coverFallbackIndices.includes(idx)) {
          // This was a cover fallback — take first result from original artist search
          track = items[0];
        } else {
          // Verify against resolved artist ID, or match by name if no ID resolved
          track = artistId
            ? items.find((item: any) =>
                item.artists.some((a: any) => a.id === artistId),
              )
            : items.find((item: any) =>
                item.artists.some(
                  (a: any) =>
                    a.name.toLowerCase() ===
                    averageSetlist.artistName.toLowerCase(),
                ),
              );
        }

        // Prefer live version if available
        if (liveTrackMap?.has(idx)) {
          track = liveTrackMap.get(idx);
        }

        if (track != null) {
          foundTracks.push({
            songTitle: track.name,
            spotifySongId: track.id,
          });
        } else {
          this.logger.log(
            `[UNMAPPED] "${song.title}"${
              song.coverArtist ? ` (cover of ${song.coverArtist})` : ''
            } - ${items.length} results`,
          );
          unfoundTracks.push(song.title);
        }
      });

      return {
        artistName: averageSetlist.artistName,
        mappedSongs: foundTracks,
        unmappedSongs: unfoundTracks,
        playlistDescription: averageSetlist.playlistDescription,
      };
    } catch (error) {
      this.handleRequestError(error, 'getTrackIdsbyArtistNameAndTrackName');
    }
  }

  private normalizeArtistName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  generateSpotifyTrackURL(
    songTitle: string,
    artistName: string,
    loose = false,
  ) {
    const cleanArtist = artistName
      .replace(/^[^a-zA-Z0-9]+/, '')
      .replace(/[^a-zA-Z0-9]+$/, '');
    if (loose) {
      const query = encodeURIComponent(`${songTitle} ${cleanArtist}`);
      return `${SPOTIFY_BASE_URL}?q=${query}&type=track&offset=0&limit=5`;
    }
    const encodedTrack = encodeURIComponent(songTitle);
    const encodedArtist = encodeURIComponent(cleanArtist);
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
      const description =
        playlistMetadata.playlistDescription ??
        `A representative setlist for ${playlistMetadata.artistName}. Generated by Setlist2Playlist App`;

      const createPlaylistRequestBody = {
        name: `${playlistMetadata.artistName} Setlist`,
        description: `${description} | Generated by Setlist2Playlist`,
        public: true,
      };

      this.logger.log(`Creating Playlist for ${playlistMetadata.artistName}`);
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
        trackCount: playlistMetadata.mappedSongs.length,
      };

      return response;
    } catch (error) {
      this.handleRequestError(error, 'createPlaylist');
    }
  }

  async getTopArtists(
    apiKey: string,
    limit = 10,
  ): Promise<{ name: string; imageUrl: string | null }[]> {
    const token = this.normalizeToken(apiKey);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const response = await lastValueFrom(
        this.httpService.get(
          `https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=${limit}`,
          { headers },
        ),
      );
      return (response.data.items ?? []).map((a: any) => ({
        name: a.name,
        imageUrl: a.images?.[0]?.url ?? null,
      }));
    } catch (error) {
      this.handleRequestError(error, 'getTopArtists');
    }
  }

  async uploadPlaylistCover(
    playlistId: string,
    base64Image: string,
    apiKey: string,
  ): Promise<void> {
    const token = this.normalizeToken(apiKey);
    try {
      await lastValueFrom(
        this.httpService.put(
          `https://api.spotify.com/v1/playlists/${playlistId}/images`,
          base64Image,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'image/jpeg',
            },
          },
        ),
      );
      this.logger.log(`Uploaded cover image for playlist ${playlistId}`);
    } catch (error) {
      // Non-fatal — playlist still works without a custom cover
      this.logger.error(
        'Failed to upload playlist cover:',
        (error as any)?.message,
      );
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

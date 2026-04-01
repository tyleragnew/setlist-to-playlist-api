import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ServiceAccountTokenManager {
  private readonly logger = new Logger(ServiceAccountTokenManager.name);
  private accessToken: string | null = null;
  private expiresAt = 0;
  private refreshPromise: Promise<string> | null = null;

  private readonly clientId = process.env.S2P_SPOTIFY_CLIENT_ID;
  private readonly clientSecret = process.env.S2P_SPOTIFY_CLIENT_SECRET;
  private readonly refreshToken = process.env.S2P_SPOTIFY_REFRESH_TOKEN;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) {
      return this.accessToken;
    }

    // Mutex: if a refresh is already in flight, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.refresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refresh(): Promise<string> {
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error(
        'Missing S2P_SPOTIFY_CLIENT_ID, S2P_SPOTIFY_CLIENT_SECRET, or S2P_SPOTIFY_REFRESH_TOKEN env vars',
      );
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Service account token refresh failed (${res.status}): ${text}`,
      );
    }

    const json = await res.json();
    this.accessToken = json.access_token;
    this.expiresAt = Date.now() + json.expires_in * 1000;

    // Spotify may rotate the refresh token
    if (json.refresh_token) {
      this.logger.warn(
        'Spotify rotated refresh token — update S2P_SPOTIFY_REFRESH_TOKEN env var',
      );
    }

    this.logger.log(`Token refreshed, expires in ${json.expires_in} seconds`);
    return this.accessToken;
  }
}

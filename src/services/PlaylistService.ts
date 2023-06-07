import { Injectable } from "@nestjs/common";
import { SpotifyClient } from "src/clients/SpotifyClient";
import { AverageSetlist } from "./SetlistService";

@Injectable()
export class PlaylistService {
    constructor(private readonly spotifyClient: SpotifyClient) { }

    getPlaylist(averageSetlist: AverageSetlist) {
        return this.spotifyClient.getTrackIdsbyArtistNameAndTrackNames(averageSetlist).then(res => { return res })
    }

}
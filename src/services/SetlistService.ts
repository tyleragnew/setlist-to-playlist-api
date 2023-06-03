import { Injectable } from "@nestjs/common";
import { SetlistFMClient } from "src/clients/SetlistFMClient";

type SongStat = {
    title: string,
    occurrences: number,
    position: number[]
};

type AverageSetlist = {
    artistName: string,
    averageSetLength: number,
    songs: string[]
}

@Injectable()
export class SetlistService {
    constructor(private readonly setlistFMClient: SetlistFMClient) { }

    getSetlistsByArtistName(artistName: string) {
        return this.setlistFMClient.getSetlistsByArtistName(artistName)
            .then((response) => {
                return this.setlistFMClient.getSongsBySetlistIds(response);
            });
    }

    async getAverageSetlistByArtistName(artistName: string) {

        const listOfSetlists = await this.getSetlistsByArtistName(artistName).then((response => {
            return response
        }));


        let setlistLength: number = 0;

        // Get number of songs in average set list and add to dictionary
        listOfSetlists.forEach(x => {
            setlistLength = setlistLength + x.length
        })

        const averageSetListLength: number = Math.round(setlistLength / listOfSetlists.length)

        const averageSetlist: AverageSetlist = {
            artistName,
            averageSetLength: averageSetListLength,
            songs: this.compileSongStats(listOfSetlists, averageSetListLength).map(i => i.title)
        }

        return averageSetlist
    }

    compileSongStats(listOfSetlists: string[][], numberOfSongs: number) {

        let songStats: SongStat[] = []
        let songStat: SongStat

        // Loop through the list of sets and add to SongStat list

        listOfSetlists.forEach((set, setIndex, listOfSetlists) => {
            set.forEach((song, songIndex, set) => {
                song = song.toUpperCase()
                // skip blank songs
                if (song === "") { }
                // check if exists, if it does update
                else if (songStats.some((obj) => obj.title === song)) {
                    let indexId = songStats.findIndex((obj) => obj.title === song);
                    songStats[indexId].occurrences++,
                        songStats[indexId].position.push(songIndex + 1)
                }
                // else create
                else {
                    songStat = {
                        title: song,
                        occurrences: 1,
                        position: [songIndex + 1]
                    }
                    songStats.push(songStat)
                }
            })
        })

        return songStats
            // Sort by number of occurrences
            .sort((a, b) => a.occurrences - b.occurrences)
            // Keep the highest occurring x number of average set
            .slice(0, numberOfSongs)
            // Sort by average position in the set
            .sort((a, b) => this.getAverageOfListOfNumbers(a.position) - this.getAverageOfListOfNumbers(b.position));

    }

    getAverageOfListOfNumbers(list: number[]) {
        const sum = list.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
        return sum / list.length;
    }

}
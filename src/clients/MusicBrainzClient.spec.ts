import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { MusicBrainzClient, ArtistMetadata } from './MusicBrainzClient';

describe('MusicBrainzClient', () => {
  let musicBrainzClient: MusicBrainzClient;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MusicBrainzClient,
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    musicBrainzClient = module.get<MusicBrainzClient>(MusicBrainzClient);
    httpService = module.get<HttpService>(HttpService);
  });

  describe('searchForMusicBrainzMetadataByArtistName', () => {
    it('should return artist metadata', async () => {
      const artist = 'artist-name';
      const mockResponse: any = {
        data: {
          artists: [
            {
              name: 'Artist 1',
              disambiguation: 'Description 1',
              id: '123',
            },
            {
              name: 'Artist 2',
              disambiguation: 'Description 2',
              id: '456',
            },
          ],
        },
      };

      jest.spyOn(httpService, 'get').mockReturnValueOnce(of(mockResponse));

      const result: ArtistMetadata[] =
        await musicBrainzClient.searchForMusicBrainzMetadataByArtistName(
          artist,
        );

      expect(httpService.get).toHaveBeenCalledWith(
        `https://musicbrainz.org/ws/2/artist/?query=${artist}`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      expect(result).toEqual([
        {
          artistName: 'Artist 1',
          description: 'Description 1',
          mbid: '123',
        },
        {
          artistName: 'Artist 2',
          description: 'Description 2',
          mbid: '456',
        },
      ]);
    });
  });
});

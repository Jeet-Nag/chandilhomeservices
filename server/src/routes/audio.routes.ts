import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import { audioService } from '../services/audio.service';

export const audioRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get<{ Params: { filename: string } }>('/:filename', async (request, reply) => {
    const { filename } = request.params;
    const filePath = audioService.getAudioFilePath(filename);

    if (!filePath) {
      return reply.status(404).send({
        success: false,
        error: {
          code: 'AUDIO_NOT_FOUND',
          messageEn: 'Audio file not found.',
          messageHi: 'ऑडियो फ़ाइल नहीं मिली।',
        },
      });
    }

    let contentType = 'audio/webm';
    if (filename.endsWith('.wav')) contentType = 'audio/wav';
    else if (filename.endsWith('.ogg')) contentType = 'audio/ogg';
    else if (filename.endsWith('.mp4')) contentType = 'audio/mp4';

    reply.header('Content-Type', contentType);
    reply.header('Accept-Ranges', 'bytes');
    return reply.send(fs.createReadStream(filePath));
  });
};

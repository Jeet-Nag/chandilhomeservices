import { buildApp } from './app';
import { env } from './config/env';

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`[Server] Chandil Home Services API running at http://${env.HOST}:${env.PORT}`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
  } catch (err) {
    console.error('[Server] Fatal error during startup:', err);
    process.exit(1);
  }
}

start();

import type { FastifyInstance } from 'fastify';
import { db } from './db';

export interface ShutdownOptions {
  timeoutMs?: number;
  dbInstance?: { close: () => Promise<void> };
}

export class ShutdownManager {
  private isShuttingDown = false;
  private isShutdownComplete = false;

  public async shutdown(
    signal: string,
    app: FastifyInstance,
    options?: ShutdownOptions
  ): Promise<boolean> {
    if (this.isShuttingDown) {
      console.log(`[Shutdown] Already shutting down. Ignoring duplicate ${signal} signal.`);
      return false;
    }
    this.isShuttingDown = true;
    const timeoutMs = options?.timeoutMs ?? 10000;
    const dbTarget = options?.dbInstance ?? db;

    console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);

    let forceExitTimer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      forceExitTimer = setTimeout(() => {
        reject(new Error(`Graceful shutdown timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      if (forceExitTimer.unref) {
        forceExitTimer.unref();
      }
    });

    const shutdownSteps = (async () => {
      // 1. Stop accepting new requests & close Fastify (in-flight requests finish cleanly)
      console.log('[Shutdown] Closing Fastify server (allowing in-flight requests to complete)...');
      await app.close();
      console.log('[Shutdown] Fastify server closed.');

      // 2. Close/drain PostgreSQL connection pool
      console.log('[Shutdown] Closing database connection pool...');
      await dbTarget.close();
      console.log('[Shutdown] Database connection pool closed.');
    })();

    try {
      await Promise.race([shutdownSteps, timeoutPromise]);
      if (forceExitTimer) clearTimeout(forceExitTimer);
      this.isShutdownComplete = true;
      console.log('[Shutdown] Graceful shutdown completed cleanly.');
      return true;
    } catch (err) {
      if (forceExitTimer) clearTimeout(forceExitTimer);
      console.error('[Shutdown] Error during graceful shutdown:', err);
      throw err;
    }
  }

  public getIsShuttingDown(): boolean {
    return this.isShuttingDown;
  }

  public getIsShutdownComplete(): boolean {
    return this.isShutdownComplete;
  }

  public resetForTesting(): void {
    this.isShuttingDown = false;
    this.isShutdownComplete = false;
  }
}

export const shutdownManager = new ShutdownManager();

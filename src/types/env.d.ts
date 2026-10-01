import 'fastify';

export declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: string;
      DATABASE_URL: string;
      ORIGINS: string;
      JWT_SECRET: string;
      JWT_EXPIRY: string;
      RESERVATION_LOCK_STRATEGY: 'pessimistic' | 'optimistic';
      SWEEPER_INTERVAL_MS: number;
    };
  }
}

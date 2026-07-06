import 'fastify';

export declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: string;
      DATABASE_URL: string;
    };
  }
}

import { server } from './app.js';

const start = async () => {
  try {
    await server.ready();

    await server.listen({
      port: Number(server.config.PORT),
      host: '0.0.0.0',
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

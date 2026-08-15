import { buildAutoflexApi } from "./app";

const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const host = process.env.HOST ?? "0.0.0.0";

const app = await buildAutoflexApi();

try {
  await app.listen({ host, port });
  app.log.info(`Autoflex API listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

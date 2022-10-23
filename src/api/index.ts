import { Router } from 'express';
import hooks from './routes/hooks';

/* TODO second argument pluginConfig: Record<string, unknown> part of PR https://github.com/medusajs/medusa/pull/959 not yet in master */
export default (container: any): Router => {
  const app = Router();
  hooks(app);
  return app;
};

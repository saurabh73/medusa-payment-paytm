import { Router } from 'express';
import * as bodyParser from 'body-parser';
import middlewares from '../../middleware';
import paytmHooks from './paytm-hooks';
const route = Router();

export default (app: Router): Router => {
  app.use('/paytm', route);
  route.use(bodyParser.json());
  route.post('/hooks', middlewares.wrap(paytmHooks));
  return app;
};

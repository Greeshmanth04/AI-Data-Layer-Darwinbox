import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import routesV1 from './routes/v1';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(pinoHttp({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
}));

// API v1 mounting
app.use('/api/v1', routesV1);

// Standardized error barrier catching all unhandled next(err) invocations
app.use(errorHandler);

export default app;

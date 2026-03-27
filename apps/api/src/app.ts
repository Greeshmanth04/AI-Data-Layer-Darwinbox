import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

// Add nice logging during development
app.use(pinoHttp({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
}));

// Route mappings...
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;

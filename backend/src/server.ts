import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import routes from './routes';
import { VectorStoreService } from './services/vectorStore';
import { prisma } from './db/prisma';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.path.includes('/status')) {
      console.log(`[${req.method}] ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api', routes);

// Root & Health Routes
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'GitHub Knowledge Assistant (GKA) API',
    status: 'online',
    version: '1.0.0',
    frontendUrl: config.frontendUrl,
    endpoints: {
      health: '/api/health',
      repositories: '/api/repos',
      chat: '/api/chat',
      auth: '/api/auth/github',
    },
    message: 'Backend API is running. Access the Web UI at ' + config.frontendUrl,
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.redirect('/api/health');
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start Server
const startServer = async () => {
  try {
    // Initialize Vector Store
    await VectorStoreService.init();

    // Verify DB connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    app.listen(config.port, () => {
      console.log(`🚀 GitHub Knowledge Assistant API running on http://localhost:${config.port}`);
      console.log(`📡 Health Check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

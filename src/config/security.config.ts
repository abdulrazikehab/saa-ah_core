
export const securityConfig = {
  cors: {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:4173', 'http://localhost:5173', 'http://localhost:4200'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  },
  rateLimit: {
    ttl: 60000, // 1 minute
    limit: 100, // 100 requests per minute
  },
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Adjust for specific needs
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'], // Allow Cloudinary
        connectSrc: ["'self'", 'https://api.hyperpay.com'], // Allow Payment Gateway
      },
    },
  },
};

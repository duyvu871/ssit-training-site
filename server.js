// Load environment variables based on NODE_ENV
const path = require('path');
const dotenv = require('dotenv');

// Load environment-specific .env file
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;

// Load .env.{NODE_ENV} first, then fallback to .env
if (require('fs').existsSync(envFile)) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config();
}

const express = require('express');
const { engine } = require('express-handlebars');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { PrismaClient } = require('@prisma/client');
const morgan = require('morgan');
const morganJson = require('morgan-json');
const rfs = require('rotating-file-stream');
const fs = require('fs');
const flash = require('connect-flash');
const hbsHelpers = require('./helpers/handlebars');
const { Pool } = require('pg');

// Ensure logs directory exists
const logDirectory = path.join(__dirname, 'logs');
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

// Create a rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
  interval: '1d', // Rotate daily
  path: logDirectory,
  size: '10M', // Rotate if size > 10MB
  compress: 'gzip' // Compress rotated files
});

// Create a rotating write stream for error logs
const errorLogStream = rfs.createStream('error.log', {
  interval: '1d', // Rotate daily
  path: logDirectory,
  size: '10M', // Rotate if size > 10MB
  compress: 'gzip' // Compress rotated files
});

// Define JSON format for logs
const logFormat = morganJson({
  method: ':method',
  url: ':url',
  status: ':status',
  responseTime: ':response-time',
  timestamp: ':date[iso]',
  'remote-addr': ':remote-addr',
  'user-agent': ':user-agent',
  'request-id': ':req[x-request-id]',
  'process-time': ':response-time ms'
});

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// Database pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Request ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  // Production logging - JSON format to files
  app.use(morgan(logFormat, { 
    stream: accessLogStream,
    skip: (req, res) => res.statusCode >= 400
  }));
  app.use(morgan(logFormat, { 
    stream: errorLogStream,
    skip: (req, res) => res.statusCode < 400
  }));
} else {
  // Development logging - colored output to console
  app.use(morgan('dev'));
}

// Log API errors
app.use((err, req, res, next) => {
  if (err) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      url: req.url,
      error: {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      },
      userId: req.session?.user?.id
    };
    
    // Log to error stream
    errorLogStream.write(JSON.stringify(errorLog) + '\n');
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', errorLog);
    }
  }
  next(err);
});

// Handlebars setup
app.engine('.hbs', engine({
    defaultLayout: 'main',
    extname: '.hbs',
    helpers: hbsHelpers,
    layoutsDir: path.join(__dirname, 'views/layouts'),
    partialsDir: path.join(__dirname, 'views/partials')
}));

app.set('view engine', '.hbs');
app.set('views', './views');

// Middleware
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
    store: new pgSession({
        pool,
        tableName: 'user_sessions'
    }),
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
}));

// Flash messages middleware
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    req.session.error_msg = 'Vui lòng đăng nhập để tiếp tục';
    res.redirect('/login');
  }
};

const requireAdmin = (req, res, next) => {
  if (req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    req.session.error_msg = 'Bạn không có quyền truy cập';
    res.redirect('/');
  }
};

// Routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const progressRoutes = require('./routes/progress');
const forumRoutes = require('./routes/forum');
const adminRoutes = require('./routes/admin');
const notificationsRoutes = require('./routes/notifications');

app.use('/auth', authRoutes);
app.use('/courses', requireAuth, courseRoutes);
app.use('/progress', requireAuth, progressRoutes);
app.use('/forum', requireAuth, forumRoutes);
app.use('/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/notifications', requireAuth, notificationsRoutes);

// Home route
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/courses');
  } else {
    res.redirect('/auth/login');
  }
});

// Login route
app.get('/login', (req, res) => {
  if (req.session.user) {
    res.redirect('/courses');
  } else {
    res.redirect('/auth/login');
  }
});

// Health check endpoint for Docker
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime() 
  });
});

// Error handling
app.use((req, res) => {
  const notFoundLog = {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    method: req.method,
    url: req.url,
    status: 404,
    userId: req.session?.user?.id
  };
  
  // Log to error stream
  errorLogStream.write(JSON.stringify(notFoundLog) + '\n');
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.warn('404 Not Found:', notFoundLog);
  }

  res.status(404).render('error', {
    title: 'Trang không tìm thấy',
    message: 'Trang bạn tìm kiếm không tồn tại.',
    requestId: req.id
  });
});

app.use((err, req, res, next) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    method: req.method,
    url: req.url,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    userId: req.session?.user?.id
  };
  
  // Log to error stream
  errorLogStream.write(JSON.stringify(errorLog) + '\n');
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Server Error:', errorLog);
  }

  res.status(500).render('error', {
    title: 'Lỗi server',
    message: 'Đã xảy ra lỗi, vui lòng thử lại sau.',
    requestId: req.id
  });
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

 
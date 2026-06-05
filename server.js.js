const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting (prevent abuse)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);

// Initialize scraper
scraper.init().catch(console.error);

// API Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'IPU Result API',
    version: '1.0.0',
    endpoints: {
      fetchResult: 'POST /api/fetch-result'
    }
  });
});

app.post('/api/fetch-result', async (req, res) => {
  try {
    const { rollNumber, password, semester } = req.body;

    // Validation
    if (!rollNumber || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Roll number and password are required' 
      });
    }

    console.log(`Fetching result for: ${rollNumber}`);

    // Fetch result
    const result = await scraper.fetchResult(rollNumber, password, semester);

    res.json(result);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Something went wrong!' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 IPU Result API running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await scraper.close();
  process.exit(0);
});
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const payment = require('./payment');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_ANON_KEY) {
  console.error('Missing Supabase settings in .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'EventKalam API', payments: payment.mode }));

app.use('/api/events', require('./routes/events'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));

app.use((req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ success: false, message: err.message || 'Server error' }); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`EventKalam API running on port ${PORT}`);
  console.log(`Payments: ${payment.mode}`);
  console.log(`Email: ${process.env.SMTP_HOST ? 'configured' : 'NOT configured (emails only logged)'}`);
});

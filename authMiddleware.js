const { admin } = require('./supabase');

// Every protected route needs a Supabase access token in the Authorization header.
// The frontend gets this token from supabase.auth.getSession() after login.
const requireUser = async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Please log in to continue' });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ success: false, message: 'Session expired. Please log in again' });

  req.token = token;
  req.userId = data.user.id;
  req.userEmail = data.user.email;
  next();
};

// Use AFTER requireUser. Looks up the profile's role using the full-access client.
const requireAdmin = async (req, res, next) => {
  const { data: profile } = await admin.from('profiles').select('role').eq('id', req.userId).single();
  if (!profile || profile.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access only' });
  next();
};

module.exports = { requireUser, requireAdmin };

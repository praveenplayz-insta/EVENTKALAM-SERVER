const express = require('express');
const { admin } = require('../supabase');
const { requireUser, requireAdmin } = require('../authMiddleware');

const router = express.Router();
router.use(requireUser, requireAdmin);

const csvCell = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stops a name/value from running as a spreadsheet formula
  return `"${s.replace(/"/g, '""')}"`;
};

// GET /api/admin/registrations/export - CSV of every registration
router.get('/registrations/export', async (req, res) => {
  const { data: regs } = await admin.from('registrations').select('*, profiles(name,email,phone), events(title,date,city)').order('created_at', { ascending: false });
  const header = ['Registration ID','Name','Email','Phone','Event','Event Date','City','Status','Payment Status','Amount','Registered On'];
  const rows = (regs || []).map(r => [r.code, r.profiles?.name, r.profiles?.email, r.profiles?.phone, r.events?.title, r.events?.date, r.events?.city, r.status, r.payment_status, r.amount, r.created_at]);
  const csv = '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="eventkalam-registrations-${Date.now()}.csv"`);
  res.send(csv);
});

module.exports = router;

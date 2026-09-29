const express = require('express');
const { admin, asUser } = require('../supabase');
const { requireUser } = require('../authMiddleware');
const payment = require('../payment');
const mail = require('../mailer');

const router = express.Router();
router.use(requireUser);

// POST /api/registrations  body: { eventId }
// Calls the same Postgres function used by the browser (register_for_event), so seat-locking
// and duplicate checks stay enforced by the database either way. This server adds payment + email on top.
router.post('/', async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.status(400).json({ success: false, message: 'eventId is required' });

  const sb = asUser(req.token);
  const { data: reg, error } = await sb.rpc('register_for_event', { p_event: eventId }).single();
  if (error) return res.status(400).json({ success: false, message: error.message });

  const { data: event } = await admin.from('events').select('*').eq('id', eventId).single();
  const { data: profile } = await admin.from('profiles').select('name,email').eq('id', req.userId).single();

  if (reg.amount == 0) {
    mail.sendMail({ to: profile.email, ...mail.registrationMail(profile, event, reg) });
    return res.status(201).json({ success: true, registration: reg, payment: null });
  }

  try {
    const order = await payment.createOrder(reg.amount, reg.code);
    await admin.from('registrations').update({ order_id: order.id }).eq('id', reg.id);
    res.status(201).json({ success: true, registration: reg, payment: { mode: payment.mode, keyId: payment.keyId, orderId: order.id, amount: order.amount, currency: order.currency } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;

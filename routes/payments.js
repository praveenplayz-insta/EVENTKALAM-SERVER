const express = require('express');
const { admin } = require('../supabase');
const { requireUser } = require('../authMiddleware');
const payment = require('../payment');
const mail = require('../mailer');

const router = express.Router();

// POST /api/payments/verify
// Confirms the seat ONLY after the Razorpay signature is verified here on the server.
router.post('/verify', requireUser, async (req, res) => {
  const { registrationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!registrationId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
    return res.status(400).json({ success: false, message: 'Missing payment details' });

  const { data: reg } = await admin.from('registrations').select('*, events(*)').eq('id', registrationId).eq('user_id', req.userId).single();
  if (!reg) return res.status(404).json({ success: false, message: 'Registration not found' });
  if (reg.status === 'confirmed') return res.json({ success: true, registration: reg });
  if (reg.order_id !== razorpay_order_id) return res.status(400).json({ success: false, message: 'Payment does not match this registration' });
  if (!payment.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature))
    return res.status(400).json({ success: false, message: 'Payment verification failed' });

  const { data: updated } = await admin.from('registrations')
    .update({ status: 'confirmed', payment_status: 'paid', payment_id: razorpay_payment_id })
    .eq('id', reg.id).select().single();

  const { data: profile } = await admin.from('profiles').select('name,email').eq('id', req.userId).single();
  mail.sendMail({ to: profile.email, ...mail.registrationMail(profile, reg.events, updated) });

  res.json({ success: true, registration: updated });
});

module.exports = router;

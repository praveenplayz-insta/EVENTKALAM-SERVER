const express = require('express');
const { admin } = require('../supabase');
const { requireUser, requireAdmin } = require('../authMiddleware');
const { announceEvent, notifyEventChanged, notifyEventCancelled } = require('../notifications');

const router = express.Router();
const ALLOWED = ['title','description','category','date','start_time','end_time','venue','city','capacity','price','image_url','status'];
const pick = (body) => Object.fromEntries(Object.entries(body).filter(([k]) => ALLOWED.includes(k)));
const WATCHED = ['date', 'start_time', 'end_time', 'venue', 'city'];

// GET /api/events - public, published events only
router.get('/', async (req, res) => {
  const { data, error } = await admin.from('events').select('*').eq('status', 'published').order('date');
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, count: data.length, events: data });
});

// GET /api/events/:id - public
router.get('/:id', async (req, res) => {
  const { data } = await admin.from('events').select('*').eq('id', req.params.id).single();
  if (!data) return res.status(404).json({ success: false, message: 'Event not found' });
  res.json({ success: true, event: data });
});

// POST /api/events - admin only. Publishing for the first time emails every subscribed user.
router.post('/', requireUser, requireAdmin, async (req, res) => {
  const { data, error } = await admin.from('events').insert(pick(req.body)).select().single();
  if (error) return res.status(400).json({ success: false, message: error.message });
  if (data.status === 'published') announceEvent(data);
  res.status(201).json({ success: true, event: data });
});

// PUT /api/events/:id - admin only
router.put('/:id', requireUser, requireAdmin, async (req, res) => {
  const { data: before } = await admin.from('events').select('*').eq('id', req.params.id).single();
  if (!before) return res.status(404).json({ success: false, message: 'Event not found' });

  const updates = pick(req.body);
  if (updates.capacity !== undefined && Number(updates.capacity) < before.registered_count)
    return res.status(400).json({ success: false, message: `Capacity cannot be lower than current registrations (${before.registered_count})` });

  const { data, error } = await admin.from('events').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ success: false, message: error.message });

  if (data.status === 'published' && before.status !== 'published') announceEvent(data);
  else if (data.status === 'published') {
    const changed = WATCHED.filter(k => String(before[k]) !== String(data[k]));
    if (changed.length) notifyEventChanged(data, changed);
  } else if (data.status === 'cancelled' && before.status !== 'cancelled') notifyEventCancelled(data);

  res.json({ success: true, event: data });
});

// DELETE /api/events/:id - admin only. Blocked while people are registered.
router.delete('/:id', requireUser, requireAdmin, async (req, res) => {
  const { count } = await admin.from('registrations').select('id', { count: 'exact', head: true }).eq('event_id', req.params.id).neq('status', 'cancelled');
  if (count > 0) return res.status(400).json({ success: false, message: `${count} active registration(s) exist. Cancel the event instead so attendees are notified.` });
  const { error } = await admin.from('events').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, message: 'Event deleted' });
});

module.exports = router;

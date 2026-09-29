const { admin } = require('./supabase');
const mail = require('./mailer');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sendInBatches = async (users, build, size = 10) => {
  for (let i = 0; i < users.length; i += size) {
    await Promise.allSettled(users.slice(i, i + size).map(u => mail.sendMail({ to: u.email, ...build(u) })));
    if (i + size < users.length) await sleep(1000);
  }
};

// Emails everyone who wants event alerts. Called once, right when an event is first published.
const announceEvent = async (event) => {
  try {
    const { data: users } = await admin.from('profiles').select('name,email').eq('role', 'user').eq('notify_events', true);
    await sendInBatches(users || [], u => mail.newEventMail(u, event));
    console.log(`Announced "${event.title}" to ${(users || []).length} users`);
  } catch (err) { console.error('announceEvent failed:', err.message); }
};

const notifyEventChanged = async (event, changed) => {
  try {
    const { data: regs } = await admin.from('registrations').select('profiles(name,email)').eq('event_id', event.id).neq('status', 'cancelled');
    await sendInBatches((regs || []).map(r => r.profiles).filter(Boolean), u => mail.eventUpdatedMail(u, event, changed));
  } catch (err) { console.error('notifyEventChanged failed:', err.message); }
};

const notifyEventCancelled = async (event) => {
  try {
    const { data: regs } = await admin.from('registrations').select('id,payment_status,profiles(id,name,email)').eq('event_id', event.id).neq('status', 'cancelled');
    for (const r of regs || []) {
      const paymentStatus = r.payment_status === 'paid' ? 'refund_pending' : r.payment_status;
      await admin.from('registrations').update({ status: 'cancelled', payment_status: paymentStatus }).eq('id', r.id);
    }
    await admin.from('events').update({ registered_count: 0 }).eq('id', event.id);
    await sendInBatches((regs || []).map(r => r.profiles).filter(Boolean),
      u => mail.eventCancelledMail(u, event, (regs.find(r => r.profiles?.id === u.id) || {}).payment_status === 'paid'));
  } catch (err) { console.error('notifyEventCancelled failed:', err.message); }
};

module.exports = { announceEvent, notifyEventChanged, notifyEventCancelled };

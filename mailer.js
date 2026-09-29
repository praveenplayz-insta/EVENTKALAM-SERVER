const nodemailer = require('nodemailer');
const CLIENT_URL = process.env.CLIENT_URL || 'https://eventkalam.netlify.app';

let transporter = null;
const getTransporter = () => {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

// Never throws - a failed email must never break a booking or an admin action.
const sendMail = async ({ to, subject, html }) => {
  const t = getTransporter();
  if (!t) { console.log(`[email not configured] would send to ${to}: ${subject}`); return false; }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html });
    return true;
  } catch (err) { console.error(`Email to ${to} failed:`, err.message); return false; }
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtPrice = (p) => (p > 0 ? `₹${p}` : 'Free');
const eventUrl = (e) => `${CLIENT_URL}/#/event/${e.id}`;

const layout = (heading, body) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#0f766e;color:#fff;padding:16px 20px;font-size:18px;font-weight:bold">EventKalam</div>
  <div style="padding:20px;color:#111827;line-height:1.5"><h2 style="margin-top:0">${heading}</h2>${body}</div>
  <div style="background:#f3f4f6;padding:12px 20px;font-size:12px;color:#6b7280">Robokalam Technologies</div>
</div>`;

const details = (e) => `<table style="border-collapse:collapse;margin:12px 0">
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Date</td><td><b>${esc(fmtDate(e.date))}</b></td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Time</td><td>${esc(e.start_time)} - ${esc(e.end_time)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Venue</td><td>${esc(e.venue)}, ${esc(e.city)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Fee</td><td>${esc(fmtPrice(e.price))}</td></tr>
</table>`;

const button = (url, label) => `<p><a href="${url}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${label}</a></p>`;

const newEventMail = (user, event) => ({
  subject: `New event: ${event.title}`,
  html: layout(esc(event.title), `<p>Hi ${esc(user.name)}, a new event is now open for registration.</p>${details(event)}${button(eventUrl(event), 'View event & register')}`),
});
const eventUpdatedMail = (user, event, changed) => ({
  subject: `Event updated: ${event.title}`,
  html: layout('Event update', `<p>Hi ${esc(user.name)}, details of <b>${esc(event.title)}</b> have changed (${esc(changed.join(', '))}).</p>${details(event)}${button(eventUrl(event), 'View event')}`),
});
const eventCancelledMail = (user, event, refund) => ({
  subject: `Event cancelled: ${event.title}`,
  html: layout('Event cancelled', `<p>Hi ${esc(user.name)}, <b>${esc(event.title)}</b> on ${esc(fmtDate(event.date))} has been cancelled.</p>${refund ? '<p>Your payment will be refunded.</p>' : ''}`),
});
const registrationMail = (user, event, reg) => ({
  subject: `Registration confirmed: ${event.title} (${reg.code})`,
  html: layout('You are registered!', `<p>Hi ${esc(user.name)}, your seat is confirmed.</p><p style="font-size:20px"><b>Registration ID: ${esc(reg.code)}</b></p>${details(event)}<p>Amount paid: <b>${esc(reg.amount > 0 ? '₹' + reg.amount : 'Free')}</b></p>`),
});

module.exports = { sendMail, newEventMail, eventUpdatedMail, eventCancelledMail, registrationMail };

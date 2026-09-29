const crypto = require('crypto');

const hasKeys = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
// mock mode lets the project be tested end-to-end before real Razorpay keys are added.
const mode = hasKeys ? 'razorpay' : 'mock';

let client = null;
const getClient = () => {
  if (!client) {
    const Razorpay = require('razorpay');
    client = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return client;
};

// amountRupees is converted to paise, since Razorpay always works in the smallest currency unit.
const createOrder = async (amountRupees, receipt) => {
  const amount = Math.round(amountRupees * 100);
  if (mode === 'mock') return { id: `mock_order_${receipt}`, amount, currency: 'INR' };
  try {
    return await getClient().orders.create({ amount, currency: 'INR', receipt });
  } catch (e) {
    throw new Error(`Payment gateway error: ${(e.error && e.error.description) || e.message}`);
  }
};

// Razorpay signs "orderId|paymentId" with the secret key. Reproducing the same signature here
// proves the payment really came from Razorpay and was not faked by the browser.
const verifySignature = (orderId, paymentId, signature) => {
  if (mode === 'mock') return signature === 'mock_signature';
  if (typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { mode, keyId: process.env.RAZORPAY_KEY_ID || '', createOrder, verifySignature };

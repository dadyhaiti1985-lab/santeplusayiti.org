import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import twilio from "twilio";
import Stripe from "stripe";
import { verifyEmail, detectSpam, checkRateLimit } from "./agent.js";

dotenv.config();

const app = express();
app.use(express.json());

// Configuration
const PAYPAL_TOKEN = process.env.PAYPAL_ACCESS_TOKEN || "YOUR_ACCESS_TOKEN";
const PAYPAL_BASE = process.env.PAYPAL_BASE || "https://api-m.sandbox.paypal.com";
const EMAIL_TO = process.env.EMAIL_TO || "meahunlimitedgroupe@gmail.com";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Twilio Configuration
const TWILIO_SID = process.env.TWILIO_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;
let twilioClient = null;
if (TWILIO_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);
}

// Stripe Configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
let stripe = null;
if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY);
}

// Email transporter setup
let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

// Contact form endpoint with agent validation
app.post("/api/contact", async (req, res) => {
  const { name, email, subject, message, ...rest } = req.body || {};

  // 1. Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: "name, email and message are required" });
  }

  // 2. Verify email format using agent
  const emailCheck = await verifyEmail(email);
  if (!emailCheck.valid) {
    return res.status(400).json({ error: emailCheck.message });
  }

  // 3. Check rate limit by email address
  const rateLimitCheck = checkRateLimit(email, 5, 3600000); // 5 requests per hour
  if (!rateLimitCheck.allowed) {
    return res.status(429).json({
      error: "Too many requests",
      retryAfter: rateLimitCheck.retryAfter
    });
  }

  // 4. Detect spam using agent
  const spamCheck = detectSpam({
    requests: 1,
    messageLength: message.length,
    hasLinks: /https?:\/\//.test(message)
  });
  if (spamCheck.isSpam) {
    console.warn(`Spam detected from ${email}: ${spamCheck.reason}`);
    return res.status(403).json({
      error: "Your message was flagged as spam",
      reason: spamCheck.reason
    });
  }

  // 5. Prepare email content
  const html = `
    <h2>New Contact from Sante Plus Ayiti</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Subject:</strong> ${subject || "(none)"}</p>
    <hr>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, "<br>")}</p>
    ${Object.keys(rest).length > 0 ? `<hr><p><strong>Additional info:</strong></p><pre>${JSON.stringify(rest, null, 2)}</pre>` : ""}
    <hr>
    <p><em>Spam score: ${spamCheck.score} | Verified: ${emailCheck.message}</em></p>
  `;

  const text = `Name: ${name}\nEmail: ${email}\nSubject: ${subject || "(none)"}\n\nMessage:\n${message}`;

  try {
    let info;
    if (transporter) {
      // Send via configured SMTP
      info = await transporter.sendMail({
        from: SMTP_USER,
        to: EMAIL_TO,
        subject: subject || `New contact from ${name}`,
        text,
        html
      });
      return res.json({
        ok: true,
        messageId: info.messageId,
        validation: { email: emailCheck, spam: spamCheck }
      });
    }

    // Fallback: Ethereal test account for dev
    const testAccount = await nodemailer.createTestAccount();
    const testTransport = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });

    info = await testTransport.sendMail({
      from: testAccount.user,
      to: EMAIL_TO,
      subject: subject || `New contact from ${name}`,
      text,
      html
    });

    const preview = nodemailer.getTestMessageUrl(info);
    return res.json({
      ok: true,
      preview,
      messageId: info.messageId,
      validation: { email: emailCheck, spam: spamCheck }
    });
  } catch (err) {
    console.error("Email error:", err.message);
    return res.status(500).json({ error: "Failed to send email", detail: err.message });
  }
});

// PayPal: Create order
app.post("/api/create-order", async (req, res) => {
  try {
    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PAYPAL_TOKEN}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: "10.00" }
        }]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PayPal: Capture order
app.post("/api/capture-order/:orderID", async (req, res) => {
  const { orderID } = req.params;
  try {
    const response = await fetch(
      `${PAYPAL_BASE}/v2/checkout/orders/${orderID}/capture`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${PAYPAL_TOKEN}` }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register endpoint with email verification and rate limiting
app.post("/api/register", async (req, res) => {
  const { name, email, phone, age, plan } = req.body || {};

  if (!email || !name) {
    return res.status(400).json({ error: "name and email are required" });
  }

  // Verify email format
  const emailCheck = await verifyEmail(email);
  if (!emailCheck.valid) {
    return res.status(400).json({ message: "Refused ❌", reason: emailCheck.message });
  }

  // Rate limit
  const rateLimitCheck = checkRateLimit(`register:${email}`, 3, 3600000);
  if (!rateLimitCheck.allowed) {
    return res.status(429).json({
      message: "Refused ❌",
      reason: "Too many registration attempts"
    });
  }

  // Log new customer (Haitian Creole comment: Nouvo kliyan)
  console.log("Nouvo kliyan:", { name, email, phone, age, plan });

  // TODO: Save to database (MongoDB pita)
  return res.json({
    success: true,
    message: "Accepted ✅",
    customer: { name, email, phone, age, plan }
  });
});

// 📞 Twilio: Call customer
app.post("/api/call-user", async (req, res) => {
  const { phone } = req.body || {};

  if (!phone || !twilioClient) {
    return res.status(400).json({
      error: "phone is required and Twilio is not configured"
    });
  }

  try {
    const call = await twilioClient.calls.create({
      url: "http://demo.twilio.com/docs/voice.xml",
      to: phone,
      from: TWILIO_PHONE
    });

    return res.json({ success: true, callSid: call.sid });
  } catch (err) {
    console.error("Twilio error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 💳 Stripe: Create payment intent
app.post("/api/pay", async (req, res) => {
  const { amount, currency = "usd" } = req.body || {};

  if (!amount || !stripe) {
    return res.status(400).json({
      error: "amount is required and Stripe is not configured"
    });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: { timestamp: new Date().toISOString() }
    });

    return res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      intentId: paymentIntent.id
    });
  } catch (err) {
    console.error("Stripe error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server ap mache sou port ${PORT}`);
  console.log(`📧 Contact: POST /api/contact`);
  console.log(`👤 Register: POST /api/register`);
  console.log(`📞 Call user: POST /api/call-user (Twilio)`);
  console.log(`💳 Payment: POST /api/pay (Stripe)`);
  console.log(`💰 PayPal: POST /api/create-order | /api/capture-order/:orderID`);
  console.log(`🏥 Health: GET /api/health`);
});

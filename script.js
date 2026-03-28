const API_BASE = "http://localhost:3000/api";

// Get form input values
function getFormData() {
  return {
    name: document.getElementById("name").value.trim(),
    age: document.getElementById("age").value.trim(),
    email: document.getElementById("email").value.trim(),
    plan: document.getElementById("plan").value
  };
}

// Register user
async function register() {
  const data = {
    name: document.getElementById("name").value.trim(),
    age: document.getElementById("age").value.trim(),
    email: document.getElementById("email").value.trim(),
    plan: document.getElementById("plan").value,
    phone: document.getElementById("phone")?.value.trim() || ""
  };

  if (!data.name || !data.email || !data.age) {
    alert("Ranpli tout champ yo / Fill all fields");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert(`✅ Ou enskri avèk siksè!\n\nBienvenue ${data.name}!`);
      clearForm();
    } else {
      alert(`❌ ${result.message || result.error}\n${result.reason || ""}`);
    }
  } catch (err) {
    alert(`Erè: ${err.message}`);
    console.error("Register error:", err);
  }
}

// Process payment with Stripe
async function pay() {
  const data = {
    name: document.getElementById("name").value.trim(),
    email: document.getElementById("email").value.trim(),
    amount: parseFloat(document.getElementById("plan").value) / 100 // Convert to dollars
  };

  if (!data.email) {
    alert("Mete email ou / Put your email");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: data.amount, currency: "usd" })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert(`✅ Payman pare!\n💳 Payment Intent: ${result.intentId}`);
      console.log("Client Secret:", result.clientSecret);
    } else {
      alert(`❌ Erè payman: ${result.error}`);
    }
  } catch (err) {
    alert(`Erè: ${err.message}`);
    console.error("Payment error:", err);
  }
}

// Call user via Twilio
async function callUser() {
  const phone = document.getElementById("phone")?.value;

  if (!phone) {
    alert("Mete nimewo telefon ou / Put your phone number");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/call-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert(`📞 Apèl ap vini...\nCall ID: ${result.callSid}`);
    } else {
      alert(`❌ Erè apèl: ${result.error}`);
    }
  } catch (err) {
    alert(`Erè: ${err.message}`);
    console.error("Call error:", err);
  }
}

// Send contact message
async function sendContact() {
  const name = document.getElementById("contact-name")?.value;
  const email = document.getElementById("contact-email")?.value;
  const message = document.getElementById("contact-message")?.value;

  if (!name || !email || !message) {
    alert("Ranpli tout champ / Fill all fields");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message })
    });

    const result = await response.json();

    if (response.ok && result.ok) {
      alert(`✅ Mesaj voye!\n\nMessage ID: ${result.messageId}`);
      if (result.preview) {
        console.log("Dev preview:", result.preview);
        alert(`Preview URL (dev): ${result.preview}`);
      }
    } else {
      alert(`❌ Erè: ${result.error || result.reason}`);
    }
  } catch (err) {
    alert(`Erè: ${err.message}`);
    console.error("Contact error:", err);
  }
}

// Clear form
function clearForm() {
  document.getElementById("name").value = "";
  document.getElementById("age").value = "";
  document.getElementById("email").value = "";
  document.getElementById("plan").value = "1000";
  if (document.getElementById("phone")) {
    document.getElementById("phone").value = "";
  }
}

// Health check
async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    const result = await response.json();
    console.log("✅ Server is up:", result);
    alert("✅ Server connected!");
  } catch (err) {
    console.error("❌ Server is down:", err);
    alert("❌ Cannot reach server. Make sure it's running on port 3000.");
  }
}

// Auto-check on page load
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Sante Plus Ayiti loaded");
  setTimeout(checkHealth, 500);
});

const express = require("express");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Statische Dateien (public/index.html)
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is not set in .env");
  process.exit(1);
}

app.post("/api/chatkit-session", async (req, res) => {
  try {
    const { user } = req.body;

    const response = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "chatkit_beta=v1"
      },
      body: JSON.stringify({
        workflow: {
          id: "wf_69134435a9e88190a4f857675fb19f4b07217f09d36a352a" // <--- HIER deine echte wf_... ID eintragen
        },
        user: user || "local-demo-user"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return res.status(500).json({ error: "Failed to create session" });
    }

    const data = await response.json();

    if (!data.client_secret) {
      console.error("Unexpected response from OpenAI:", data);
      return res.status(500).json({ error: "No client_secret in response" });
    }

    return res.json({ client_secret: data.client_secret });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
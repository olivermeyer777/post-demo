export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

  if (!OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY is not set");
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "OpenAI-Beta": "chatkit_beta=v1"
      },
      body: JSON.stringify({
        workflow: {
          id: "wf_69134435a9e88190a4f857675fb19f4b07217f09d36a352a" // 
        },
        user: "web-demo-user"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      res.status(500).json({ error: "Failed to create session" });
      return;
    }

    const data = await response.json();

    if (!data.client_secret) {
      console.error("Unexpected response from OpenAI:", data);
      res.status(500).json({ error: "No client_secret in response" });
      return;
    }

    res.status(200).json({ client_secret: data.client_secret });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

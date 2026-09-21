const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.post("/analyze", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "A prompt is required."
      });
    }

    const answer = await askLocalAI(prompt);

    res.json({
      answer
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "AI request failed."
    });
  }
});

async function askLocalAI(prompt) {
  /*
    BTW THIS IS LOCAL WE DONT SEE YOUR CHATS well if you care i guess
  */

  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "llama3.2:3b",
      prompt,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Local AI error: ${errorText}`);
  }

  const data = await response.json();

  return data.response;
}

app.listen(PORT, () => {
  console.log(`AI server running at http://localhost:${PORT}`);
});

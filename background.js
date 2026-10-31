async function readJson(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }

  return data;
}

async function apiKeyFor(provider) {
  const result = await chrome.storage.local.get("apiKeys");
  const key = result.apiKeys?.[provider];

  if (!key) {
    throw new Error(`No API key saved for ${provider}.`);
  }

  return key;
}

async function callOpenAI(model, messages, apiKey) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: messages.map(({ role, content }) => ({ role, content }))
    })
  });

  const data = await readJson(response);

  const text =
    data.output_text ||
    data.output
      ?.flatMap((item) => item.content || [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text)
      .join("\n");

  if (!text) {
    throw new Error("OpenAI returned no text response.");
  }

  return text;
}

async function callGemini(model, messages, apiKey) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: messages.map(({ role, content }) => ({
        role: role === "assistant" ? "model" : "user",
        parts: [{ text: content }]
      }))
    })
  });

  const data = await readJson(response);
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");

  if (!text) {
    throw new Error("Gemini returned no text response.");
  }

  return text;
}

async function callAnthropic(model, messages, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: messages.map(({ role, content }) => ({ role, content }))
    })
  });

  const data = await readJson(response);
  const text = data.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  if (!text) {
    throw new Error("Claude returned no text response.");
  }

  return text;
}

async function handleChat(message) {
  const { provider, model, messages } = message;

  if (!["openai", "gemini", "anthropic"].includes(provider)) {
    throw new Error("Unsupported provider.");
  }

  if (typeof model !== "string" || !model.trim()) {
    throw new Error("Choose a valid model ID.");
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Send a message first.");
  }

  const safeMessages = messages
    .filter(
      (item) =>
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string"
    )
    .map((item) => ({
      role: item.role,
      content: item.content
    }));

  const apiKey = await apiKeyFor(provider);

  if (provider === "openai") {
    return callOpenAI(model, safeMessages, apiKey);
  }

  if (provider === "gemini") {
    return callGemini(model, safeMessages, apiKey);
  }

  return callAnthropic(model, safeMessages, apiKey);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "CHAT") {
    return false;
  }

  handleChat(message)
    .then((answer) => sendResponse({ ok: true, answer }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

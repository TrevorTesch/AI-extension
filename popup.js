const catalogs = {
  openai: [
    { label: "GPT-6 Luna", id: "gpt-6-luna" },
    { label: "GPT-6.1 Sol", id: "gpt-6.1-sol" },
    { label: "GPT-6 Astra", id: "gpt-6-astra" }
  ],
  gemini: [
    { label: "Gemini 3.8 Flash", id: "gemini-3.8-flash" },
    { label: "Gemini 4 Argon", id: "gemini-4-argon" }
  ],
  anthropic: [
    { label: "Claude Haiku 5.5", id: "claude-haiku-5-5" },
    { label: "Claude Sonnet 5.5", id: "claude-sonnet-5-5" },
    { label: "Claude Opus 5.5", id: "claude-opus-5-5" }
  ]
};

const providerSelect = document.querySelector("#provider");
const modelSelect = document.querySelector("#model");
const customModelInput = document.querySelector("#customModel");
const apiKeyInput = document.querySelector("#apiKey");
const keyStatus = document.querySelector("#keyStatus");

const setupScreen = document.querySelector("#setupScreen");
const chatScreen = document.querySelector("#chatScreen");
const chatLog = document.querySelector("#chatLog");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const chatStatus = document.querySelector("#chatStatus");
const sendButton = document.querySelector("#sendButton");

let activeProvider = "";
let activeModel = "";
let chatMessages = [];
let isSending = false;

function populateModels() {
  const provider = providerSelect.value;
  modelSelect.innerHTML = "";

  for (const model of catalogs[provider]) {
    const option = document.createElement("option");
    option.value = model.id;
    option.textContent = model.label;
    modelSelect.append(option);
  }

  const customOption = document.createElement("option");
  customOption.value = "__custom__";
  customOption.textContent = "Enter a custom model ID…";
  modelSelect.append(customOption);

  customModelInput.hidden = true;
  customModelInput.value = "";
  refreshKeyStatus();
}

function selectedModel() {
  return modelSelect.value === "__custom__"
    ? customModelInput.value.trim()
    : modelSelect.value;
}

async function savedKeys() {
  const result = await chrome.storage.local.get("apiKeys");
  return result.apiKeys || {};
}

async function refreshKeyStatus() {
  const keys = await savedKeys();
  const exists = Boolean(keys[providerSelect.value]);

  keyStatus.textContent = exists
    ? "An API key is saved in this browser profile."
    : "No key saved for this provider yet.";
}

async function saveKey() {
  const key = apiKeyInput.value.trim();

  if (!key) {
    keyStatus.textContent = "Paste an API key first.";
    return;
  }

  const keys = await savedKeys();
  keys[providerSelect.value] = key;
  await chrome.storage.local.set({ apiKeys: keys });

  apiKeyInput.value = "";
  keyStatus.textContent = "API key saved in this browser profile.";
}

async function forgetKey() {
  const keys = await savedKeys();
  delete keys[providerSelect.value];
  await chrome.storage.local.set({ apiKeys: keys });

  apiKeyInput.value = "";
  keyStatus.textContent = "Saved API key removed.";
}

function addBubble(role, text) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;
  bubble.textContent = text;
  chatLog.append(bubble);
  chatLog.scrollTop = chatLog.scrollHeight;
  return bubble;
}

async function startChat() {
  const provider = providerSelect.value;
  const model = selectedModel();

  if (!model) {
    keyStatus.textContent = "Choose or enter a model ID.";
    return;
  }

  const typedKey = apiKeyInput.value.trim();

  if (typedKey) {
    const keys = await savedKeys();
    keys[provider] = typedKey;
    await chrome.storage.local.set({ apiKeys: keys });
    apiKeyInput.value = "";
  }

  const keys = await savedKeys();

  if (!keys[provider]) {
    keyStatus.textContent = "Save an API key for this provider first.";
    return;
  }

  activeProvider = provider;
  activeModel = model;
  chatMessages = [];
  chatLog.replaceChildren();
  chatStatus.textContent = "";
  document.querySelector("#activeModel").textContent = model;

  setupScreen.hidden = true;
  chatScreen.hidden = false;
  messageInput.focus();
}

async function sendPrompt(text) {
  const prompt = text.trim();

  if (!prompt || isSending) return;

  chatMessages.push({ role: "user", content: prompt });
  addBubble("user", prompt);

  isSending = true;
  sendButton.disabled = true;
  chatStatus.textContent = "Thinking…";

  const pendingBubble = addBubble("assistant", "…");

  try {
    const result = await chrome.runtime.sendMessage({
      type: "CHAT",
      provider: activeProvider,
      model: activeModel,
      messages: chatMessages
    });

    if (!result?.ok) {
      throw new Error(result?.error || "The model request failed.");
    }

    pendingBubble.textContent = result.answer;
    chatMessages.push({ role: "assistant", content: result.answer });
    chatStatus.textContent = "";
  } catch (error) {
    pendingBubble.className = "message error";
    pendingBubble.textContent = `Error: ${error.message}`;
    chatStatus.textContent = "Check the provider, model ID, API key, and internet connection.";
  } finally {
    isSending = false;
    sendButton.disabled = false;
    messageInput.focus();
  }
}

async function analyzeCurrentPage() {
  chatStatus.textContent = "Reading the current page…";

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab?.id) {
      throw new Error("No active tab was found.");
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title || "Untitled page",
        url: location.href,
        text: document.body?.innerText?.slice(0, 14000) || ""
      })
    });

    const page = results?.[0]?.result;

    if (!page?.text.trim()) {
      throw new Error("No readable text was found on this page.");
    }

    await sendPrompt(
      `Analyze this webpage. Give me a useful summary, explain its main points, and answer any obvious questions a reader might have.

Page title: ${page.title}
Page URL: ${page.url}

Page text:
${page.text}`
    );
  } catch (error) {
    chatStatus.textContent =
      `Could not read this page: ${error.message}`;
  }
}

providerSelect.addEventListener("change", populateModels);

modelSelect.addEventListener("change", () => {
  customModelInput.hidden = modelSelect.value !== "__custom__";
  if (!customModelInput.hidden) customModelInput.focus();
});

document.querySelector("#saveKey").addEventListener("click", saveKey);
document.querySelector("#forgetKey").addEventListener("click", forgetKey);
document.querySelector("#startChat").addEventListener("click", startChat);

document.querySelector("#changeModel").addEventListener("click", () => {
  chatMessages = [];
  setupScreen.hidden = false;
  chatScreen.hidden = true;
  chatStatus.textContent = "";
});

document.querySelector("#analyzePage").addEventListener("click", analyzeCurrentPage);

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = messageInput.value;
  messageInput.value = "";
  await sendPrompt(text);
});

populateModels();

const analyzeButton = document.getElementById("analyze");
const askButton = document.getElementById("ask");
const questionInput = document.getElementById("question");
const answerBox = document.getElementById("answer");

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab;
}

analyzeButton.addEventListener("click", async () => {
  analyzeButton.disabled = true;
  answerBox.textContent = "Analyzing page...";

  try {
    const tab = await getCurrentTab();

    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_PAGE",
      tabId: tab.id
    });

    if (!response.ok) {
      throw new Error(response.error);
    }

    answerBox.textContent = response.answer;
  } catch (error) {
    answerBox.textContent = `Error: ${error.message}`;
  } finally {
    analyzeButton.disabled = false;
  }
});

askButton.addEventListener("click", async () => {
  const question = questionInput.value.trim();

  if (!question) {
    answerBox.textContent = "Type a question first.";
    return;
  }

  askButton.disabled = true;
  answerBox.textContent = "Thinking...";

  try {
    const tab = await getCurrentTab();

    const response = await chrome.runtime.sendMessage({
      type: "ASK_QUESTION",
      tabId: tab.id,
      question
    });

    if (!response.ok) {
      throw new Error(response.error);
    }

    answerBox.textContent = response.answer;
  } catch (error) {
    answerBox.textContent = `Error: ${error.message}`;
  } finally {
    askButton.disabled = false;
  }
});

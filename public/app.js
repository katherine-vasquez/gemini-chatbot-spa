import {
  resolveRoute,
  sendChatMessage,
  parseRetryDelaySeconds,
  saveHistory,
  loadHistory,
  clearHistory,
  hasStoredHistory,
  formatTimestamp,
} from "./utils.js";

const app = document.getElementById("app");
const navLinks = document.querySelectorAll("#navbar .navLink");

// When the app loads, we restore the saved history (if any) instead of
// always starting from scratch — persisted via localStorage.
let messages = loadHistory();

// -------------------- HOME --------------------
function renderHome() {
  app.innerHTML = `
    <div class="homeView">
      <div class="heroImage">
        <img src="./assets/solstice.png" alt="Solstice" />
      </div>

      <h1>Solstice Chat ✨</h1>
      <p class="tagline">Meridian City's light-wielding guardian, now in a chat.</p>

      <div class="infoCard">
        <h2>About the character</h2>
        <p>
          Mia Reyes is an engineering student in Meridian City who gained the
          ability to generate and shape solid light after a lab accident.
          By day she's a regular student; by night, she protects the city as
          Solstice, always upbeat and driven by a strong sense of
          responsibility.
        </p>
      </div>

      <a class="navLink" href="/chat">Start chatting</a>
    </div>
  `;
}

// -------------------- ABOUT --------------------
function renderAbout() {
  app.innerHTML = `
    <div class="aboutView">
      <h1>About</h1>

      <div class="infoCard">
        <h2>The Character</h2>
        <p>
          Solstice (Mia Reyes) is an original character created for this
          project. She combines warmth, curiosity, and a strong sense of
          responsibility, summed up in her catchphrase: "let's shine some
          light on that."
        </p>
      </div>

      <div class="infoCard">
        <h2>The Project</h2>
        <p>
          Solstice Chat is a Single Page Application that lets you chat with
          Solstice using Google Gemini AI, with routing implemented via the
          History API and a mobile-first design.
        </p>
      </div>

      <div class="infoCard">
        <h2>Technologies</h2>
        <ul>
          <li>HTML, CSS, and JavaScript (Vanilla, ES Modules)</li>
          <li>Google Gemini AI</li>
          <li>Vercel Serverless Functions</li>
          <li>Vitest for testing</li>
        </ul>
      </div>

      <a class="navLink" href="/chat">Go to chat</a>
    </div>
  `;
}

// -------------------- CHAT --------------------
function renderChat() {
  app.innerHTML = `
    <div class="chatView">
      <h1>Chat with Solstice ✨</h1>

      <div class="chat-header-row">
        <span id="historyBadge" class="historyBadge">💾 History saved</span>
        <button id="clearHistoryBtn" class="clearBtn">Clear history</button>
      </div>

      <div id="chatBox" class="chat-box"></div>

      <div class="chat-input-row">
        <input id="inputMessage" placeholder="Type a message..." />
        <button id="sendBtn">Send</button>
      </div>
    </div>
  `;

  renderMessages();

  const input = document.getElementById("inputMessage");
  document.getElementById("sendBtn").addEventListener("click", sendMessage);

  document.getElementById("clearHistoryBtn").addEventListener("click", () => {
    messages = [];
    clearHistory();
    renderMessages();
  });

  // "Copy" button on each Solstice reply: a single listener for the
  // whole message box (event delegation), since the inner HTML is fully
  // rebuilt on every renderMessages() call.
  document.getElementById("chatBox").addEventListener("click", (event) => {
    const button = event.target.closest(".copyBtn");
    if (!button) return;

    const index = Number(button.dataset.index);
    const text = messages[index]?.text;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
      const original = button.textContent;
      button.textContent = "✅";
      setTimeout(() => {
        button.textContent = original;
      }, 1200);
    });
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      sendMessage();
    }
  });
}

// -------------------- 404 --------------------
function renderNotFound() {
  app.innerHTML = `
    <h1>404 - Page not found</h1>
    <p>The route <code>${window.location.pathname}</code> does not exist.</p>
  `;
}

// -------------------- RENDER MESSAGES --------------------
function renderMessages() {
  const chatBox = document.getElementById("chatBox");
  if (!chatBox) return;

  chatBox.innerHTML = messages
    .map((msg, index) => {
      // "Typing..." indicator with animated dots (CSS), instead of
      // static text.
      if (msg.isTyping) {
        return `
          <p class="msg msg-bot msg-typing">
            <b>Solstice:</b>
            <span class="typingDots"><span></span><span></span><span></span></span>
          </p>
        `;
      }

      const isUser = msg.role === "User";
      const timeLabel = msg.time ? formatTimestamp(msg.time) : "";
      const showCopyBtn = !isUser && !msg.isCountdown;

      return `
        <p class="msg msg-${isUser ? "user" : "bot"}">
          <b>${msg.role}:</b> ${msg.text}
          ${timeLabel ? `<span class="msgTime">${timeLabel}</span>` : ""}
          ${showCopyBtn ? `<button class="copyBtn" data-index="${index}" title="Copy reply">📋</button>` : ""}
        </p>
      `;
    })
    .join("");

  chatBox.scrollTop = chatBox.scrollHeight;

  // We only persist the "real" messages (neither the "typing..."
  // indicator nor the 429 countdown messages are worth saving for the
  // next time the chat is opened).
  const persistable = messages.filter((m) => !m.isTyping && !m.isCountdown);

  if (persistable.length > 0) {
    saveHistory(persistable);
  } else {
    clearHistory();
  }
  updateHistoryBadge();
}

function updateHistoryBadge() {
  const badge = document.getElementById("historyBadge");
  if (!badge) return;
  badge.classList.toggle("visible", hasStoredHistory());
}

// -------------------- SEND MESSAGE --------------------
async function sendMessage() {
  const input = document.getElementById("inputMessage");
  const sendBtn = document.getElementById("sendBtn");
  const text = input.value.trim();

  if (!text) return;

  // Snapshot the history BEFORE adding the current message, so we can
  // send it to Gemini and have the character keep context.
  const historyForAPI = [...messages];

  messages.push({ role: "User", text, time: Date.now() });
  renderMessages();
  input.value = "";

  // Lock the input and button while waiting for a response: prevents the
  // user from sending several messages within a second and triggering a
  // 429 from too many requests.
  input.disabled = true;
  sendBtn.disabled = true;

  messages.push({ role: "Solstice", isTyping: true });
  renderMessages();

  try {
    const reply = await sendChatMessage(text, historyForAPI);
    messages.pop(); // remove the "typing..." indicator
    messages.push({ role: "Solstice", text: reply, time: Date.now() });
    renderMessages();
    unlockChatInput();
  } catch (error) {
    console.error("Error talking to Solstice:", error);
    messages.pop(); // remove the "typing..." indicator

    if (error.status === 429) {
      // Specific case: rate limit exceeded. Show a visual countdown and
      // keep the chat locked until it finishes.
      const seconds = parseRetryDelaySeconds(error.retryDelay);
      runRateLimitCountdown(seconds);
    } else {
      messages.push({
        role: "Solstice",
        text: "Error connecting to Solstice 😢",
        time: Date.now(),
      });
      renderMessages();
      unlockChatInput();
    }
  }
}

function unlockChatInput() {
  const input = document.getElementById("inputMessage");
  const sendBtn = document.getElementById("sendBtn");
  if (!input || !sendBtn) return;
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
}

// Shows "I'm busy... wait Ns" and counts down every second. Once it hits
// 0, unlocks the chat so the user can type again.
function runRateLimitCountdown(seconds) {
  let remaining = seconds;

  const tick = () => {
    if (messages.length && messages[messages.length - 1].isCountdown) {
      messages.pop();
    }

    if (remaining <= 0) {
      messages.push({
        role: "Solstice",
        text: "I'm back! What can I help you with? ✨",
        isCountdown: true,
      });
      renderMessages();
      unlockChatInput();
      return;
    }

    messages.push({
      role: "Solstice",
      text: `Deflecting a lot of questions at once... give me ${remaining}s ✨`,
      isCountdown: true,
    });
    renderMessages();

    remaining -= 1;
    setTimeout(tick, 1000);
  };

  tick();
}

// -------------------- ACTIVE NAV --------------------
function updateActiveNavLink(route) {
  navLinks.forEach((link) => {
    const linkRoute = link.getAttribute("href").replace("/", "");
    link.classList.toggle("active", linkRoute === route);
  });
}

// -------------------- ROUTER --------------------
function router() {
  const route = resolveRoute(window.location.pathname);

  if (route === "chat") renderChat();
  else if (route === "about") renderAbout();
  else if (route === "home") renderHome();
  else renderNotFound(); // unknown route → 404

  updateActiveNavLink(route);
}

function navigateTo(path) {
  history.pushState(null, "", path);
  router();
}

// -------------------- SELECTIVE CLICK INTERCEPTION --------------------
// We use real <a href="/route"> links (accessibility, SEO, right-click,
// Ctrl-click) and only intercept normal clicks on internal links.
document.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;

  const href = link.getAttribute("href");
  if (!href) return;

  // Let these pass through: Ctrl/Cmd/Shift-click (open in new tab),
  // target=_blank, external links, anchors, mailto and tel.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.target === "_blank") return;
  if (link.origin !== window.location.origin) return;
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
  if (!href.startsWith("/")) return;

  event.preventDefault();
  navigateTo(href);
});

window.addEventListener("popstate", router);

router(); // Initial render based on the current URL

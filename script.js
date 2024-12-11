const chatbotToggler = document.querySelector(".chatbot-toggler");
const chatbox = document.querySelector(".chatbox");
const chatInput = document.querySelector(".chat-input textarea");
const sendTextChatBtn = document.querySelector(".chat-input #send-btn");
const sendAttachmentChatBtn = document.querySelector(
  ".chat-input #attachment-btn"
);
const attachmentInput = document.querySelector("#attachment-input");
const counterBadge = document.querySelector(".counter-badge");
let socket;
let unreadCount = 0;
let userMessage = null;

//#region User Identity
function getUserId() {
  let userId =
    localStorage.getItem("userId") != null
      ? localStorage.getItem("userId")
      : getOrGenerateCookie("almatar_user");

  return userId;
}

function getOrGenerateCookie(cookieName) {
  const getCookie = (name) => {
    const cookiePrefix = `${name}=`;
    const cookies = document.cookie.split(";");

    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(cookiePrefix)) {
        return decodeURIComponent(cookie.substring(cookiePrefix.length));
      }
    }
    return "";
  };

  const setCookie = (name, value, days) => {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${d.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/`;
  };

  let cookieValue = getCookie(cookieName);

  if (!cookieValue) {
    cookieValue = Math.floor(10000000000 + Math.random() * 90000000000);
    setCookie(cookieName, cookieValue, 365);
  }

  return cookieValue;
}

//#endregion

//#region Outbound
const createChatLi = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", `${className}`);
  let chatContent =
    className === "outgoing"
      ? `<p></p>`
      : `<span class="material-symbols-outlined">smart_toy</span><p></p>`;
  chatLi.innerHTML = chatContent;
  chatLi.querySelector("p").textContent = message;
  return chatLi;
};

const handleChat = () => {
  userMessage = chatInput.value.trim();
  if (!userMessage) return;

  chatInput.value = "";
  chatInput.style.height = `${inputInitHeight}px`;

  removeThinkingMessages();

  chatbox.appendChild(createChatLi(userMessage, "outgoing"));
  chatbox.scrollTo(0, chatbox.scrollHeight);

  const incomingChatLi = createChatLi("...", "incoming");
  chatbox.appendChild(incomingChatLi);
  chatbox.scrollTo(0, chatbox.scrollHeight);

  sendText(userMessage);
};

const handleChatForAttachments = (attachment) => {
  if (!attachment) return;

  const attachmentType = attachment.type;

  let attachmentElement;
  if (attachmentType.startsWith("image/")) {
    attachmentElement = createImageMessageOutbound(attachment);
  } else if (attachmentType.startsWith("audio/")) {
    attachmentElement = createAudioMessageOutbound(attachment);
  } else if (attachmentType.startsWith("video/")) {
    attachmentElement = createVideoMessageOutbound(attachment);
  } else if (
    attachmentType.startsWith("application/") ||
    attachmentType.startsWith("text/")
  ) {
    attachmentElement = createDocumentMessageOutbound(attachment);
  } else {
    attachmentElement = createFileMessageOutbound(attachment);
  }

  chatbox.appendChild(attachmentElement);
  chatbox.scrollTo(0, chatbox.scrollHeight);

  const reader = new FileReader();
  reader.readAsDataURL(attachment);

  reader.onload = async function () {
    const result = {};

    const type = reader.result.substring(
      "data:".length,
      reader.result.indexOf(";base64")
    );
    if (type.includes("image/")) result.type = "image";
    if (type.includes("video/")) result.type = "video";
    if (type.includes("application/")) result.type = "document";
    if (type.includes("audio/")) result.type = "audio";

    result.contentType = type;
    result.attachement = reader.result;

    removeThinkingMessages();

    const incomingChatLi = createChatLi("...", "incoming");
    chatbox.appendChild(incomingChatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);

    sendAttachment(result);
  };

  reader.onerror = function (error) {
    console.error("FileReader error: ", error);
    const errorChatLi = createChatLi(
      "Error processing attachment.",
      "incoming error"
    );
    chatbox.appendChild(errorChatLi);
    chatbox.scrollTo(0, chatbox.scrollHeight);
  };
};

function sendText(text) {
  socket.emit("message", { text, userId: getUserId() });
}

function sendAttachment(_obj) {
  socket.emit("attachment", _obj);
}

function createImageMessageOutbound(attachment) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");

  const image = document.createElement("img");
  image.setAttribute("src", URL.createObjectURL(attachment));
  image.setAttribute("alt", "image");
  image.setAttribute("width", "100%");

  paragraph.appendChild(image);
  listItem.appendChild(paragraph);

  return listItem;
}

function createAudioMessageOutbound(attachment) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");

  const audio = document.createElement("audio");
  audio.setAttribute("src", URL.createObjectURL(attachment));
  audio.setAttribute("width", "100%");
  audio.setAttribute("controls", "");

  paragraph.appendChild(audio);
  listItem.appendChild(paragraph);

  return listItem;
}

function createVideoMessageOutbound(attachment) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");

  const video = document.createElement("video");
  video.setAttribute("src", URL.createObjectURL(attachment));
  video.setAttribute("width", "100%");
  video.setAttribute("controls", "");

  paragraph.appendChild(video);
  listItem.appendChild(paragraph);

  return listItem;
}

function createDocumentMessageOutbound(attachment) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");
  paragraph.classList.add("overwritten-content-width");

  // Create the link and image elements
  const link = document.createElement("a");
  link.setAttribute("target", "_blank");
  link.setAttribute("href", URL.createObjectURL(attachment));
  link.style.display = "block";
  link.style.textAlign = "center";
  link.setAttribute("width", "100");

  const documentImage = document.createElement("img");
  documentImage.setAttribute("src", "assets/open-folder.png");
  documentImage.setAttribute("width", "50%");
  documentImage.setAttribute("alt", "document");

  link.appendChild(documentImage);

  const fileNameParagraph = document.createElement("p");
  fileNameParagraph.textContent = attachment.name;
  fileNameParagraph.style.textAlign = "center";
  fileNameParagraph.style.paddingTop = "0px";

  paragraph.appendChild(link);
  paragraph.appendChild(fileNameParagraph);

  // Append the paragraph to the list item
  listItem.appendChild(paragraph);

  return listItem;
}

function createFileMessageOutbound(attachment) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");

  const fileInfo = document.createElement("span");
  fileInfo.textContent = `File: ${attachment.name} (${Math.round(
    attachment.size / 1024
  )} KB)`;

  paragraph.appendChild(fileInfo);
  listItem.appendChild(paragraph);

  return listItem;
}

function removeThinkingMessages() {
  const incomingChats = document.querySelectorAll(".chat.incoming p");

  incomingChats.forEach((p) => {
    if (p.textContent === "...") {
      const chatItem = p.closest("li");
      if (chatItem) {
        chatItem.remove();
      }
    }
  });
}
//#endregion

//#region Inbound
function handleSocketReply(params) {
  handleNotificationBadge();
  let messageHtml = "";
  const text = params.text?.body || params.text;
  switch (params.type) {
    case "text":
      messageHtml = createTextMessage(text);
      break;
    case "image":
      messageHtml = createImageMessage(params.image.link, params.image.caption);
      break;
    case "audio":
      messageHtml = createAudioMessage(params.audio, text);
      break;
    case "video":
      messageHtml = createVideoMessage(params.video, text);
      break;
    case "document":
      messageHtml = createDocumentMessage(params.file, text);
      break;
    case "interactive":
      messageHtml = createInteractiveMessage(params);
      break;
    default:
      messageHtml = createTextMessage(text || "Something went wrong ...");
  }
  appendMessageToChat(messageHtml);
}

function createTextMessage(text) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "incoming");

  const icon = document.createElement("span");
  icon.classList.add("material-symbols-outlined");
  icon.textContent = "smart_toy";

  const paragraph = document.createElement("p");
  paragraph.innerHTML = formatText(text);

  listItem.appendChild(icon);
  listItem.appendChild(paragraph);

  return listItem;
}

function createImageMessage(attachement, text) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "incoming");

  const icon = document.createElement("span");
  icon.classList.add("material-symbols-outlined");
  icon.textContent = "smart_toy";

  const interactiveContainer = document.createElement("div");
  interactiveContainer.classList.add("interactive-container");

  if (text) {
    const textParagraph = document.createElement("p");
    textParagraph.innerHTML = formatText(text);
    interactiveContainer.appendChild(textParagraph);
  }

  const link = document.createElement("a");
  link.setAttribute("target", "_blank");
  link.setAttribute("href", attachement);

  const image = document.createElement("img");
  image.setAttribute("src", attachement);
  image.setAttribute("alt", "image");
  image.setAttribute("width", "100%");

  const paragraph = document.createElement("p");
  paragraph.appendChild(link);
  link.appendChild(image);

  interactiveContainer.appendChild(paragraph);

  listItem.appendChild(icon);
  listItem.appendChild(interactiveContainer);

  return listItem;
}

function createAudioMessage(attachement, text) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "incoming");

  const icon = document.createElement("span");
  icon.classList.add("material-symbols-outlined");
  icon.textContent = "smart_toy";

  const interactiveContainer = document.createElement("div");
  interactiveContainer.classList.add("interactive-container");

  if (text) {
    const textParagraph = document.createElement("p");
    textParagraph.innerHTML = formatText(text);
    interactiveContainer.appendChild(textParagraph);
  }

  const paragraph = document.createElement("p");

  const audio = document.createElement("audio");
  audio.setAttribute("src", attachement);
  audio.setAttribute("width", "100%");
  audio.setAttribute("controls", "");

  paragraph.appendChild(audio);
  interactiveContainer.appendChild(paragraph);

  listItem.appendChild(icon);
  listItem.appendChild(interactiveContainer);

  return listItem;
}

function createVideoMessage(attachement, text) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "incoming");

  const icon = document.createElement("span");
  icon.classList.add("material-symbols-outlined");
  icon.textContent = "smart_toy";

  const interactiveContainer = document.createElement("div");
  interactiveContainer.classList.add("interactive-container");

  if (text) {
    const textParagraph = document.createElement("p");
    textParagraph.innerHTML = formatText(text);
    interactiveContainer.appendChild(textParagraph);
  }

  const paragraph = document.createElement("p");

  const video = document.createElement("video");
  video.setAttribute("src", attachement);
  video.setAttribute("width", "100%");
  video.setAttribute("controls", "");

  paragraph.appendChild(video);
  interactiveContainer.appendChild(paragraph);

  listItem.appendChild(icon);
  listItem.appendChild(interactiveContainer);

  return listItem;
}

function createDocumentMessage(attachement, text) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "incoming");

  const icon = document.createElement("span");
  icon.classList.add("material-symbols-outlined");
  icon.textContent = "smart_toy";

  const interactiveContainer = document.createElement("div");
  interactiveContainer.classList.add("interactive-container");

  if (text) {
    const textParagraph = document.createElement("p");
    textParagraph.innerHTML = formatText(text);
    interactiveContainer.appendChild(textParagraph);
  }

  const paragraph = document.createElement("p");

  const link = document.createElement("a");
  link.setAttribute("target", "_blank");
  link.setAttribute("href", attachement);

  const documentImage = document.createElement("img");
  documentImage.setAttribute("src", "../chatbot/assets/open-folder.png");
  documentImage.setAttribute("width", "100%");
  documentImage.setAttribute("alt", "document");

  link.appendChild(documentImage);
  paragraph.appendChild(link);
  interactiveContainer.appendChild(paragraph);

  listItem.appendChild(icon);
  listItem.appendChild(interactiveContainer);

  return listItem;
}

function createInteractiveMessage(params) {
  const formattedList = formatInteractiveObject(params);
  if (formattedList) {
    const listItem = document.createElement("li");
    listItem.classList.add("chat", "incoming");

    const icon = document.createElement("span");
    icon.classList.add("material-symbols-outlined");
    icon.textContent = "smart_toy";

    listItem.appendChild(icon);
    listItem.appendChild(formattedList);

    return listItem;
  }
  return null;
}

function formatText(text) {
  return text
    .replace(/(?:\r\n|\r|\n)/g, "<br>")
    .replace(
      /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi,
      "<a target='_blank' href='$1'>$1</a>"
    )
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>");
}

function appendMessageToChat(element) {
  removeThinkingMessages();
  chatbox.appendChild(element);
  chatbox.scrollTo(0, chatbox.scrollHeight);
}

function handleAttachmentSent(_data) {
  handleNotificationBadge();
  const { type, attachement } = _data;

  let msg = "";
  switch (type) {
    case "audio":
      msg = createSentAudioMessage(attachement);
      break;
    case "image":
      msg = createSentImageMessage(attachement);
      break;
    case "document":
      msg = createSentDocumentMessage(attachement);
      break;
    case "video":
      msg = createSentVideoMessage(attachement);
      break;
    default:
      break;
  }

  appendMessageToChat(msg);
}

function createSentAudioMessage(attachement) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");

  const audio = document.createElement("audio");
  audio.setAttribute("controls", "");

  const sourceOgg = document.createElement("source");
  sourceOgg.setAttribute("src", attachement);
  sourceOgg.setAttribute("type", "audio/ogg");

  const sourceMpeg = document.createElement("source");
  sourceMpeg.setAttribute("src", attachement);
  sourceMpeg.setAttribute("type", "audio/mpeg");

  audio.appendChild(sourceOgg);
  audio.appendChild(sourceMpeg);
  paragraph.appendChild(audio);
  listItem.appendChild(paragraph);

  return listItem;
}

function createSentImageMessage(attachement) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");

  const image = document.createElement("img");
  image.setAttribute("src", attachement);
  image.setAttribute("alt", "image");
  image.setAttribute("width", "100%");

  paragraph.appendChild(image);
  listItem.appendChild(paragraph);

  return listItem;
}

function createSentDocumentMessage(attachement) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");

  const link = document.createElement("a");
  link.setAttribute("target", "_blank");
  link.setAttribute("href", attachement);

  const documentImage = document.createElement("img");
  documentImage.setAttribute("src", "../chatbot/assets/open-folder.png");
  documentImage.setAttribute("width", "100%");
  documentImage.setAttribute("alt", "document");

  link.appendChild(documentImage);
  paragraph.appendChild(link);
  listItem.appendChild(paragraph);

  return listItem;
}

function createSentVideoMessage(attachement) {
  const listItem = document.createElement("li");
  listItem.classList.add("chat", "outgoing");

  const paragraph = document.createElement("p");

  const video = document.createElement("video");
  video.setAttribute("controls", "");
  video.setAttribute("src", attachement);

  const fallbackText = document.createTextNode(
    "Your browser does not support the video tag."
  );
  video.appendChild(fallbackText);
  paragraph.appendChild(video);
  listItem.appendChild(paragraph);

  return listItem;
}

function formatInteractiveObject(obj) {
  if (obj.type !== "interactive" || !obj.interactive) {
    return null;
  }

  const container = document.createElement("div");
  container.classList.add("interactive-container");

  const interactiveType = obj.interactive.type;
  const headerText = obj.interactive.header?.text;
  const bodyText = obj.interactive.body?.text;

  if (headerText && !bodyText) {
    const header = document.createElement("p");
    header.classList.add("button-list-header");
    header.innerHTML = formatText(headerText);
    container.appendChild(header);
  }

  if (bodyText) {
    const body = document.createElement("p");
    body.classList.add("button-list-body");
    body.innerHTML = formatText(bodyText);
    container.appendChild(body);
  }

  const buttonList = document.createElement("div");
  buttonList.classList.add("button-list-container");
  buttonList.style.display = "flex";
  buttonList.style.flexDirection = "column";

  const itemList =
    interactiveType === "list"
      ? obj.interactive.action.sections[0].rows
      : obj.interactive.action.buttons;

  const maxCharacters = 24;
  const maxItems = 10;

  itemList.slice(0, maxItems).forEach((item) => {
    const itemTitle = item?.title || item?.reply?.title;
    if (itemTitle) {
      const button = document.createElement("button");
      button.classList.add("button-list-item");
      button.style.margin = "5px";
      button.textContent = itemTitle;
      button.addEventListener("click", () => {
        chatInput.value = itemTitle;
        handleChat();
      });
      buttonList.appendChild(button);
    }
  });

  container.appendChild(buttonList);

  return container;
}
//#endregion

//#region Chat
const inputInitHeight = chatInput.scrollHeight;

chatInput.addEventListener("input", () => {
  chatInput.style.height = `${inputInitHeight}px`;
  chatInput.style.height = `${chatInput.scrollHeight}px`;
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
    e.preventDefault();
    handleChat();
  }
});

sendTextChatBtn.addEventListener("click", handleChat);
sendAttachmentChatBtn.addEventListener("click", () => {
  attachmentInput.click();
});
attachmentInput.addEventListener("change", (e) => {
  const attachment = e.target.files[0];
  if (attachment) {
    handleChatForAttachments(attachment);
    attachmentInput.value = null;
  }
});

chatbotToggler.addEventListener("click", () => {
  if (!isChatboxOpen()) {
    counterBadge.style.visibility = "hidden";
    unreadCount = 0;
  }
  document.body.classList.toggle("show-chatbot");
});

function isChatboxOpen() {
  return document.body.classList.contains("show-chatbot");
}

function handleNotificationBadge() {
  unreadCount = isChatboxOpen() ? 0 : unreadCount + 1;
  counterBadge.textContent = unreadCount;
  counterBadge.style.visibility =
    unreadCount > 0 && !isChatboxOpen() ? "visible" : "hidden";
}
//#endregion

function socketsInit(token, domain) {
  socket = io(domain, {
    query: `identity=${getUserId()}&token=${token}`,
    transports: ["websocket"],
    withCredentials: true,
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 2000,
  });

  socket.on("connect", () => console.log("Socket connected!"));

  socket.on("reconnect", (attemptNumber) => {
    console.log(`Reconnected after attempt number ${attemptNumber}`);
  });

  socket.on("reconnect_error", (error) => {
    console.error("Failed to reconnect:", error.message);
  });

  socket.on("reconnect_failed", () => {
    console.error("All reconnection attempts failed. Connection lost.");
  });

  socket.on("reply", handleSocketReply);
  socket.on("attachment-sent", handleAttachmentSent);
}

window.addEventListener("load", () => {
  socketsInit(
    "PnbnvdklNObUYQwaoPnmBIRMNvKamJInMrIwWruqUnEimXrQcjumtOjPlHVelZcG",
    "alpha.alm6ar.com"
  );
});

javascript: (() => {
  // Configurações e constantes
  const CONFIG = {
    BADGE_ID: "citation-tool", // ID for the main element within Shadow DOM
    HOST_ID: "citation-tool-host", // ID for the host element in the light DOM
    APP_INFO: {
      name: "Citation Tool",
      version: "v20250514-sDOM",
      credits: "by @magasine",
    },
    FORMATS: [
      { value: "default", text: "Whatsapp Format" },
      { value: "academic", text: "Academic Citation" },
      { value: "html", text: "HTML" },
      { value: "markdown", text: "Markdown" },
      { value: "plain", text: "Simple Text" },
      { value: "twitter", text: "Twitter/X" },
    ],
    READABILITY_SERVICES: [
      {
        name: "PrintFriendly",
        url: (url) =>
          `https://www.printfriendly.com/print/?url=${encodeURIComponent(url)}`,
      },
      {
        name: "Archive.is",
        url: (url) => `https://archive.is/${encodeURIComponent(url)}`,
      },
    ],
    CONTENT_SELECTORS: [
      "article",
      '[role="main"]',
      ".main-content",
      "#content",
      ".content",
      "main",
    ],
    CLIPBOARD_SEPARATOR: "\n---\n",
  };

  // Estado da aplicação
  const state = {
    clipboardItems: [],
    captureMode: "selection",
    isMinimized: false,
  };

  // Função de sanitização
  const sanitize = (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // Utilitários
  const Utils = {
    copyToClipboard: async (text) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        document.body.appendChild(textarea); // This can stay in document.body for the fallback
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        return success;
      } catch (error) {
        console.error("Copy error:", error);
        return false;
      }
    },

    showFeedback: (shadowRoot, message, duration = 3000) => {
      let feedback = shadowRoot.getElementById("citation-feedback");
      if (!feedback) {
        feedback = document.createElement("div");
        feedback.id = "citation-feedback";
        Object.assign(feedback.style, {
          position: "fixed", // Positioned relative to viewport, but within shadow DOM styles
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "10px 20px",
          borderRadius: "5px",
          zIndex: "10000", // z-index within the host's stacking context
          opacity: "0",
          transition: "opacity 0.3s",
        });
        shadowRoot.appendChild(feedback);
      }
      feedback.textContent = sanitize(message);
      feedback.style.opacity = "1";
      setTimeout(() => (feedback.style.opacity = "0"), duration);
    },

    getPageContent: () => {
      const selection = window.getSelection().toString().trim();
      if (selection) return sanitize(selection);
      for (const selector of CONFIG.CONTENT_SELECTORS) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          const sanitizedText = sanitize(text);
          return sanitizedText.length > 280
            ? sanitizedText.substring(0, 280) + "..."
            : sanitizedText;
        }
      }
      return "No text selected or main content found.";
    },

    getClipboardText: async () => {
      try {
        const text = await navigator.clipboard?.readText();
        return text ? sanitize(text) : "Clipboard access not supported";
      } catch (error) {
        return "Could not access clipboard";
      }
    },
  };

  // Funcionalidades de citação
  const Citation = {
    format: (format, text, title, url, service, includeLink) => {
      const separator = "(...)";
      const serviceUrl = service.url(url);
      const safeText = sanitize(text);
      const safeTitle = sanitize(title);
      const safeUrl = sanitize(url);
      const safeServiceUrl = sanitize(serviceUrl);
      const formats = {
        plain: () =>
          `${safeTitle}\n\n${separator}\n${safeText}\n${separator}\n\nSource: ${safeUrl}` +
          (includeLink ? `\nReadable: ${safeServiceUrl}` : ""),
        markdown: () =>
          `# ${safeTitle}\n\n> ${safeText.replace(
            /\n/g,
            "\n> "
          )}\n\n[Source](${safeUrl})` +
          (includeLink ? `\n\n[Readable](${safeServiceUrl})` : ""),
        html: () =>
          `<blockquote><h2>${safeTitle}</h2><p>${safeText.replace(
            /\n/g,
            "<br>"
          )}</p>` +
          `<footer><a href="${safeUrl}">Source</a>` +
          (includeLink
            ? ` | <a href="${safeServiceUrl}">Readable</a></footer></blockquote>`
            : "</footer></blockquote>"),
        twitter: () =>
          `"${
            safeText.length > 240
              ? safeText.substring(0, 240) + "..."
              : safeText
          }"\n\n${safeUrl}`,
        academic: () =>
          `${safeTitle}. Retrieved from ${safeUrl} on ${new Date().toLocaleDateString()}`,
        default: () =>
          `*${safeTitle}*\n\n${separator}\n${safeText}\n${separator}\n\n- Source: ${safeUrl}` +
          (includeLink ? `\n- Readable: ${safeServiceUrl}` : ""),
      };
      return (formats[format] || formats.default)();
    },
    share: {
      whatsapp: (text) =>
        window.open(
          `https://wa.me/?text=${encodeURIComponent(text)}`,
          "_blank"
        ),
      twitter: (text) =>
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
          "_blank"
        ),
      email: (text, title) =>
        window.open(
          `mailto:?subject=${encodeURIComponent(
            title
          )}&body=${encodeURIComponent(text)}`,
          "_blank"
        ),
      qrCode: (text) =>
        window.open(
          `https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=300`,
          "_blank"
        ),
    },
  };

  // UI Components
  const UI = {
    createStyles: (shadowRoot) => {
      const style = document.createElement("style");
      style.textContent = `
         /* Styles are now scoped to the Shadow DOM */
         :host {
           /* Styles for the host element itself, if needed from within */
           /* For example, to ensure it's positioned if it's not done by the script that creates the host */
           position: fixed;
           top: 10px;
           right: 10px;
           z-index: 999999; /* High z-index for the host */
         }

         .citation-tool {
           /* position, top, right, z-index are now controlled by :host or hostElement directly */
           /* width, background, border, etc. remain for the main tool element */
           width: 350px;
           background: #fff;
           border: 1px solid #ddd;
           border-radius: 10px;
           font-family: sans-serif;
           box-shadow: 0 2px 10px rgba(0,0,0,0.1);
           /* display: block; or flex, depending on layout needs if :host is display: contents */
         }
         
         .citation-header {
           display: flex;
           justify-content: space-between;
           align-items: center;
           padding: 8px 12px;
           background: #296fa7;
           color: white;
           cursor: move;
         }
         
         .citation-container {
           padding: 12px;
           max-height: 70vh;
           overflow-y: auto;
         }
         
         .citation-preview {
           padding: 8px;
           margin: 8px 0;
           border: 1px solid #eee;
           border-radius: 4px;
           max-height: 120px;
           overflow-y: auto;
           white-space: pre-wrap;
           font-size: 13px;
         }
         
         .citation-button {
           width: 100%;
           padding: 8px;
           margin: 4px 0;
           border: none;
           border-radius: 4px;
           background: #4CAF50;
           color: white;
           cursor: pointer;
         }

         .citation-tool.minimized {
           height: auto !important; /* This might need adjustment if host controls size */
         }
    
         .citation-tool.minimized .citation-container {
           display: none;
        }
    
         select, input {
           width: 100%;
           padding: 6px;
           margin: 4px 0;
           border: 1px solid #ddd;
           border-radius: 4px;
           box-sizing: border-box; /* Good practice */
         }
         
         .window-controls button {
           background: none;
           border: none;
           color: white;
           cursor: pointer;
         }
         
         /* Dark mode styles will also be scoped */
         @media (prefers-color-scheme: dark) {
           .citation-tool { background: #333; color: #fff; border-color: #444; }
           .citation-header { background: #1a4a73; }
           .citation-preview { background: #222; border-color: #444; }
           select, input { background: #444; color: #fff; border-color: #555; }
         }
       `;
      shadowRoot.appendChild(style);
    },

    createUI: (shadowRoot, hostElement) => {
      // Pass shadowRoot for feedback, hostElement for close action
      const { pageUrl, pageTitle, selectedText } = {
        pageUrl: location.href,
        pageTitle: document.title || "Untitled",
        selectedText: Utils.getPageContent(),
      };

      const badge = document.createElement("div");
      badge.className = "citation-tool";
      badge.id = CONFIG.BADGE_ID; // ID within Shadow DOM

      const header = document.createElement("div");
      header.className = "citation-header";

      const title = document.createElement("h3");
      title.textContent = CONFIG.APP_INFO.name;

      const versionBadge = document.createElement("sup");
      versionBadge.textContent = CONFIG.APP_INFO.version;
      Object.assign(versionBadge.style, {
        color: "#bcbcbc",
        fontSize: "0.7em",
        fontWeight: "300",
        padding: "5px",
      });
      title.appendChild(versionBadge);

      const controls = document.createElement("div");
      controls.className = "window-controls";

      const minimizeBtn = document.createElement("button");
      minimizeBtn.className = "minimize-btn";
      minimizeBtn.textContent = "−";
      Object.assign(minimizeBtn.style, {
        background: "none",
        border: "none",
        color: "white",
        cursor: "pointer",
        fontSize: "1.2em",
        marginRight: "8px",
        padding: "0 5px",
        width: "20px",
        textAlign: "center",
        lineHeight: "1",
      });

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "×";
      Object.assign(closeBtn.style, {
        background: "none",
        border: "none",
        color: "white",
        cursor: "pointer",
        fontSize: "1.2em",
        padding: "0 5px",
        width: "20px",
        textAlign: "center",
        lineHeight: "1",
      });

      controls.appendChild(minimizeBtn);
      controls.appendChild(closeBtn);
      header.appendChild(title);
      header.appendChild(controls);

      const container = document.createElement("div");
      container.className = "citation-container";

      const modeSelector = document.createElement("div");
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Capture Mode:";
      modeSelector.appendChild(modeLabel);

      const modeButtons = document.createElement("div");
      Object.assign(modeButtons.style, { display: "flex", margin: "8px 0" });

      const selectionBtn = document.createElement("button");
      selectionBtn.textContent = "Selection";
      selectionBtn.dataset.mode = "selection";
      Object.assign(selectionBtn.style, {
        flex: "1",
        padding: "6px",
        background: state.captureMode === "selection" ? "#296fa7" : "",
        color: state.captureMode === "selection" ? "white" : "",
      });

      const clipboardBtn = document.createElement("button");
      clipboardBtn.textContent = "Clipboard";
      clipboardBtn.dataset.mode = "clipboard";
      Object.assign(clipboardBtn.style, {
        flex: "1",
        padding: "6px",
        background: state.captureMode === "clipboard" ? "#296fa7" : "",
        color: state.captureMode === "clipboard" ? "white" : "",
      });

      modeButtons.appendChild(selectionBtn);
      modeButtons.appendChild(clipboardBtn);
      modeSelector.appendChild(modeButtons);

      const preview = document.createElement("div");
      preview.className = "citation-preview";
      preview.textContent = selectedText;

      const clipboardControls = document.createElement("div");
      clipboardControls.style.display =
        state.captureMode === "clipboard" ? "block" : "none";

      const addClipboardBtn = document.createElement("button");
      addClipboardBtn.className = "citation-button";
      addClipboardBtn.style.background = "#9c27b0";
      addClipboardBtn.textContent = "Add from Clipboard";
      addClipboardBtn.id = "add-clipboard";

      const clearClipboardBtn = document.createElement("button");
      clearClipboardBtn.className = "citation-button";
      clearClipboardBtn.textContent = "Clear Collection";
      clearClipboardBtn.id = "clear-clipboard";

      clipboardControls.appendChild(addClipboardBtn);
      clipboardControls.appendChild(clearClipboardBtn);

      const formatLabel = document.createElement("label");
      formatLabel.textContent = "Format:";
      const formatSelect = document.createElement("select");
      formatSelect.id = "format-select";
      CONFIG.FORMATS.forEach((f) => {
        const option = document.createElement("option");
        option.value = f.value;
        option.textContent = f.text;
        formatSelect.appendChild(option);
      });

      const readabilityLabel = document.createElement("label");
      readabilityLabel.textContent = "Readability Service:";
      const readabilitySelect = document.createElement("select");
      readabilitySelect.id = "readability-select";
      CONFIG.READABILITY_SERVICES.forEach((s, i) => {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = s.name;
        readabilitySelect.appendChild(option);
      });

      const readabilityCheckLabel = document.createElement("label");
      const readabilityCheck = document.createElement("input");
      readabilityCheck.type = "checkbox";
      readabilityCheck.id = "include-readability";
      readabilityCheck.checked = true;
      readabilityCheckLabel.appendChild(readabilityCheck);
      readabilityCheckLabel.appendChild(
        document.createTextNode(" Include readability link")
      );

      const copyBtn = document.createElement("button");
      copyBtn.className = "citation-button";
      copyBtn.textContent = "Copy to Clipboard";
      copyBtn.id = "copy-button";

      const whatsappBtn = document.createElement("button");
      whatsappBtn.className = "citation-button";
      whatsappBtn.style.background = "#2196F3";
      whatsappBtn.textContent = "Share on WhatsApp";
      whatsappBtn.id = "whatsapp-button";

      const twitterBtn = document.createElement("button");
      twitterBtn.className = "citation-button";
      twitterBtn.style.background = "#1DA1F2";
      twitterBtn.textContent = "Share on Twitter/X";
      twitterBtn.id = "twitter-button";

      const emailBtn = document.createElement("button");
      emailBtn.className = "citation-button";
      emailBtn.style.background = "#FF5722";
      emailBtn.textContent = "Share via Email";
      emailBtn.id = "email-button";

      const readabilityBtn = document.createElement("button");
      readabilityBtn.className = "citation-button";
      readabilityBtn.style.background = "#ff9800";
      readabilityBtn.textContent = "View in Readability Service";
      readabilityBtn.id = "readability-button";

      const qrBtn = document.createElement("button");
      qrBtn.className = "citation-button";
      qrBtn.textContent = "Capture by QR Code";
      qrBtn.id = "qr-button";

      const footer = document.createElement("div");
      Object.assign(footer.style, {
        padding: "8px",
        textAlign: "center",
        fontSize: "12px",
      });
      const creditsLink = document.createElement("a");
      creditsLink.href = "https://linktr.ee/magasine";
      creditsLink.target = "_blank";
      creditsLink.style.color = "inherit";
      creditsLink.textContent = CONFIG.APP_INFO.credits;
      footer.appendChild(creditsLink);

      container.appendChild(modeSelector);
      container.appendChild(preview);
      container.appendChild(clipboardControls);
      container.appendChild(formatLabel);
      container.appendChild(formatSelect);
      container.appendChild(readabilityLabel);
      container.appendChild(readabilitySelect);
      container.appendChild(readabilityCheckLabel);
      container.appendChild(copyBtn);
      container.appendChild(whatsappBtn);
      container.appendChild(twitterBtn);
      container.appendChild(emailBtn);
      container.appendChild(readabilityBtn);
      container.appendChild(qrBtn);

      badge.appendChild(header);
      badge.appendChild(container);
      badge.appendChild(footer);

      const updatePreview = () => {
        clipboardControls.style.display =
          state.captureMode === "clipboard" ? "block" : "none";
        if (state.captureMode === "clipboard") {
          preview.textContent = state.clipboardItems.length
            ? state.clipboardItems
                .map(
                  (item, i) =>
                    `[${i + 1}] ${
                      item.length > 100 ? item.substring(0, 100) + "..." : item
                    }\n${CONFIG.CLIPBOARD_SEPARATOR}`
                )
                .join("")
            : "No clipboard items added yet.";
        } else {
          preview.textContent = Utils.getPageContent();
        }
      };

      [selectionBtn, clipboardBtn].forEach((btn) => {
        btn.addEventListener("click", () => {
          state.captureMode = btn.dataset.mode;
          selectionBtn.style.background =
            state.captureMode === "selection" ? "#296fa7" : "";
          selectionBtn.style.color =
            state.captureMode === "selection" ? "white" : "";
          clipboardBtn.style.background =
            state.captureMode === "clipboard" ? "#296fa7" : "";
          clipboardBtn.style.color =
            state.captureMode === "clipboard" ? "white" : "";
          updatePreview();
        });
      });

      addClipboardBtn.addEventListener("click", async () => {
        const text = await Utils.getClipboardText();
        if (text && !text.includes("Clipboard access")) {
          state.clipboardItems.push(text);
          updatePreview();
          Utils.showFeedback(shadowRoot, "✓ Added to collection!");
        } else {
          Utils.showFeedback(shadowRoot, "✗ Could not access clipboard");
        }
      });

      clearClipboardBtn.addEventListener("click", () => {
        state.clipboardItems = [];
        updatePreview();
        Utils.showFeedback(shadowRoot, "✓ Collection cleared");
      });

      const getFormattedText = () => {
        const format = formatSelect.value;
        const service = CONFIG.READABILITY_SERVICES[readabilitySelect.value];
        const includeLink = readabilityCheck.checked;
        const text =
          state.captureMode === "selection"
            ? preview.textContent
            : state.clipboardItems.join(CONFIG.CLIPBOARD_SEPARATOR);
        return Citation.format(
          format,
          text,
          pageTitle,
          pageUrl,
          service,
          includeLink
        );
      };

      copyBtn.addEventListener("click", async () => {
        const success = await Utils.copyToClipboard(getFormattedText());
        Utils.showFeedback(shadowRoot, success ? "✓ Copied!" : "✗ Copy failed");
      });

      whatsappBtn.addEventListener("click", () =>
        Citation.share.whatsapp(getFormattedText())
      );
      twitterBtn.addEventListener("click", () =>
        Citation.share.twitter(getFormattedText())
      );
      emailBtn.addEventListener("click", () =>
        Citation.share.email(getFormattedText(), pageTitle)
      );
      readabilityBtn.addEventListener("click", () => {
        const service = CONFIG.READABILITY_SERVICES[readabilitySelect.value];
        window.open(service.url(pageUrl), "_blank");
      });
      qrBtn.addEventListener("click", () =>
        Citation.share.qrCode(getFormattedText())
      );

      minimizeBtn.addEventListener("click", () => {
        state.isMinimized = !state.isMinimized;
        badge.classList.toggle("minimized", state.isMinimized);
        minimizeBtn.textContent = state.isMinimized ? "+" : "−";
        Utils.showFeedback(
          shadowRoot,
          state.isMinimized ? "UI minimized" : "UI restored"
        );
      });

      closeBtn.addEventListener("click", () => hostElement.remove()); // Remove the host element

      document.addEventListener("selectionchange", () => {
        if (state.captureMode === "selection") {
          setTimeout(() => {
            const selection = window.getSelection().toString().trim();
            if (selection) preview.textContent = sanitize(selection);
          }, 300); // Debounce slightly
        }
      });

      return badge;
    },
  };

  // Arrastar o elemento (host)
  const dragElement = (element, dragHandle) => {
    let pos1 = 0,
      pos2 = 0,
      pos3 = 0,
      pos4 = 0;
    const handleMouseDown = (e) => {
      // e.preventDefault(); // Prevent text selection on drag handle
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.addEventListener("mouseup", closeDrag);
      document.addEventListener("mousemove", elementDrag);
    };
    const elementDrag = (e) => {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      let newTop = element.offsetTop - pos2;
      let newLeft = element.offsetLeft - pos1;

      // Keep within viewport boundaries
      const hostRect = element.getBoundingClientRect();
      if (newTop < 0) newTop = 0;
      if (newLeft < 0) newLeft = 0;
      if (newTop + hostRect.height > window.innerHeight)
        newTop = window.innerHeight - hostRect.height;
      if (newLeft + hostRect.width > window.innerWidth)
        newLeft = window.innerWidth - hostRect.width;

      element.style.top = newTop + "px";
      element.style.left = newLeft + "px";
    };
    const closeDrag = () => {
      document.removeEventListener("mouseup", closeDrag);
      document.removeEventListener("mousemove", elementDrag);
    };
    dragHandle.addEventListener("mousedown", handleMouseDown);
  };

  // Inicialização
  const init = () => {
    const existingHost = document.getElementById(CONFIG.HOST_ID);
    if (existingHost) {
      existingHost.remove();
      // Optionally, show feedback if it was re-invoked
      // Find a way to show feedback if shadowRoot isn't available yet or use a global one for this specific case.
      // For now, just remove and recreate.
    }

    const hostElement = document.createElement("div");
    hostElement.id = CONFIG.HOST_ID;
    // Initial position for the host, can be overridden by drag or further styling.
    // The :host rule in createStyles also sets position:fixed, top, right.
    // If those are sufficient, direct style manipulation here might not be needed
    // or could be set to ensure initial placement before CSS in shadow DOM applies if there's a flash.
    // hostElement.style.position = "fixed";
    // hostElement.style.top = "10px";
    // hostElement.style.right = "10px";
    // hostElement.style.zIndex = "999999";

    document.body.appendChild(hostElement);

    const shadow = hostElement.attachShadow({ mode: "open" });

    UI.createStyles(shadow);
    const citationToolElement = UI.createUI(shadow, hostElement); // Pass shadow and host
    shadow.appendChild(citationToolElement);

    const headerElement = citationToolElement.querySelector(".citation-header");
    if (headerElement) {
      dragElement(hostElement, headerElement);
    }
  };

  init();
})();

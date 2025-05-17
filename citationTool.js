javascript: (() => {
  // Configurações e constantes
  const CONFIG = {
    BADGE_ID: "citation-tool",
    HOST_ID: "citation-tool-host",
    APP_INFO: {
      name: "Citation Tool",
      version: "v20250516", // Versão com Shadow DOM, trusted types e lógica de toggle
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

  const state = {
    clipboardItems: [],
    captureMode: "selection",
    isMinimized: false,
  };

  // Função de sanitização mantida para Trusted Types
  const sanitize = (str) => {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/	asdasd/g, "&#39;");
  };

  // Utils module
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
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textarea);
        return success;
      } catch (error) {
        console.error(`[${CONFIG.APP_INFO.name}] Copy error:`, error);
        return false;
      }
    },
    
    showFeedback: (shadowRoot, message, duration = 3000) => {
      let feedback = shadowRoot.getElementById("citation-feedback");
      if (!feedback) {
        feedback = document.createElement("div");
        feedback.id = "citation-feedback";
        feedback.className = "citation-feedback";
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

  // Citation module
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
          )}</p><footer><a href="${safeUrl}">Source</a>` +
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

  // UI module
  const UI = {
    createStyles: (shadowRoot) => {
      const style = document.createElement("style");
      const cssText = `
        :host { 
          position: fixed; 
          top: 10px; 
          right: 10px; 
          z-index: 999999; 
        }
        
        .citation-tool { 
          width: 300px; 
          background: #fff; 
          border: 1px solid #ddd; 
          border-radius: 10px; 
          font-family: Roboto, Helvetica, Arial, sans-serif; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        
        .citation-tool a { 
          text-decoration: none; 
        }
        
        .citation-tool a:hover { 
          text-decoration: underline; 
        }
        
        .citation-header { 
          font-size: 1.1em; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding: 0px 18px; 
          background: #296fa7; 
          color: white; 
          cursor: move; 
          border-top-left-radius: 10px;
          border-top-right-radius: 10px;
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
          font-size: 14px;
        }
        
        .citation-button.whatsapp { 
          background: #2196F3; 
        }
        
        .citation-button.twitter { 
          background: #2196F3; 
        }
        
        .citation-button.email { 
          background: #2196F3; 
        }
        
        .citation-button.readability { 
          background: #EA4335; 
        }
        
        .citation-button.clear { 
          background: #EA4335; 
        }
        
        .citation-button.qr { 
          background: #4CAF50; 
        }
        
        .citation-tool.minimized { 
          height: auto !important; 
        }
        
        .citation-tool.minimized .citation-container { 
          display: none; 
        }
        
        select { 
          width: 100%; 
          padding: 6px; 
          margin: 4px 0; 
          border: 1px solid #ddd; 
          border-radius: 4px; 
          box-sizing: border-box; 
          font-size: 14px;
        }
        
        input[type="checkbox"] { 
          display: inline-flex; 
          padding: 6px; 
          margin: 0 8px; 
        }
        
        label { 
          font-size: 1em; 
          display: inline-flex; 
          padding: 6px; 
          align-items: center; 
        }
        
        .window-controls { 
          display: flex; 
          align-items: center; 
        }
        
        .window-controls button { 
          background: none; 
          border: none; 
          color: white; 
          cursor: pointer; 
          font-size: 1.2em; 
          padding: 0 5px; 
          width: 20px; 
          text-align: center; 
          line-height: 1; 
        }
        
        .window-controls .minimize-btn { 
          margin-right: 8px; 
        }
        
        .mode-selector { 
          margin-bottom: 8px; 
        }
        
        .mode-buttons { 
          display: flex; 
          margin: 8px 0; 
          border-radius: 4px; 
          overflow: hidden;
          border: 1px solid #ddd;
        }
        
        .mode-buttons button { 
          flex: 1; 
          padding: 6px; 
          border: none;
          background: #f5f5f5;
          cursor: pointer;
        }
        
        .mode-buttons button.active { 
          background: #296fa7; 
          color: white; 
        }
        
        .citation-footer { 
          padding: 8px; 
          text-align: center; 
          font-size: 12px; 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          gap: 4px; 
          flex-wrap: wrap; 
          border-bottom-left-radius: 10px;
          border-bottom-right-radius: 10px;
          background: #f5f5f5;
        }
        
        .citation-footer a { 
          color: #296fa7; 
        }
        
        .clipboard-controls { 
          margin: 8px 0; 
        }
        
        #citation-feedback {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          z-index: 10000;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }
        
        @media (prefers-color-scheme: dark) {
          .citation-tool { 
            background: #333; 
            color: #fff; 
            border-color: #444; 
          }
          
          .citation-header { 
            background: #1a4a73; 
          }
          
          .citation-preview { 
            background: #222; 
            border-color: #444; 
          }
          
          select, input { 
            background: #444; 
            color: #fff; 
            border-color: #555; 
          }
          
          .mode-buttons button { 
            background: #444;
            color: #fff;
          }
          
          .citation-footer {
            background: #444;
            color: #fff;
          }
          
          .citation-footer a {
            color: #64B5F6;
          }
        }
      `;
      style.appendChild(document.createTextNode(cssText));
      shadowRoot.appendChild(style);
    },
    
    createUI: (shadowRoot, hostElement) => {
      const { pageUrl, pageTitle, selectedText } = {
        pageUrl: location.href,
        pageTitle: document.title || "Untitled",
        selectedText: Utils.getPageContent(),
      };
      
      const badge = document.createElement("div");
      badge.className = "citation-tool";
      badge.id = CONFIG.BADGE_ID;
      
      const header = document.createElement("div");
      header.className = "citation-header";
      const titleElement = document.createElement("h3");
      titleElement.textContent = CONFIG.APP_INFO.name;

      const controls = document.createElement("div");
      controls.className = "window-controls";
      const minimizeBtn = document.createElement("button");
      minimizeBtn.className = "minimize-btn";
      minimizeBtn.textContent = "−";
      
      const closeBtn = document.createElement("button");
      closeBtn.textContent = "×";
      
      controls.appendChild(minimizeBtn);
      controls.appendChild(closeBtn);
      header.appendChild(titleElement);
      header.appendChild(controls);
      
      const container = document.createElement("div");
      container.className = "citation-container";
      
      // Mode selector
      const modeSelector = document.createElement("div");
      modeSelector.className = "mode-selector";
      const modeLabel = document.createElement("label");
      modeLabel.textContent = "Capture Mode:";
      modeSelector.appendChild(modeLabel);
      
      const modeButtons = document.createElement("div");
      modeButtons.className = "mode-buttons";
      
      const selectionBtn = document.createElement("button");
      selectionBtn.textContent = "Selection";
      selectionBtn.dataset.mode = "selection";
      if (state.captureMode === "selection") selectionBtn.classList.add("active");
      
      const clipboardBtn = document.createElement("button");
      clipboardBtn.textContent = "Clipboard";
      clipboardBtn.dataset.mode = "clipboard";
      if (state.captureMode === "clipboard") clipboardBtn.classList.add("active");
      
      modeButtons.appendChild(selectionBtn);
      modeButtons.appendChild(clipboardBtn);
      modeSelector.appendChild(modeButtons);
      
      const preview = document.createElement("div");
      preview.className = "citation-preview";
      preview.textContent = selectedText;
      
      const clipboardControls = document.createElement("div");
      clipboardControls.className = "clipboard-controls";
      clipboardControls.style.display =
        state.captureMode === "clipboard" ? "block" : "none";
      
      const addClipboardBtn = document.createElement("button");
      addClipboardBtn.className = "citation-button";
      addClipboardBtn.textContent = "Add from Clipboard";
      addClipboardBtn.id = "add-clipboard";
      
      const clearClipboardBtn = document.createElement("button");
      clearClipboardBtn.className = "citation-button clear";
      clearClipboardBtn.textContent = "Clear Collection";
      clearClipboardBtn.id = "clear-clipboard";
      
      clipboardControls.appendChild(addClipboardBtn);
      clipboardControls.appendChild(clearClipboardBtn);
      
      // Format controls
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
      
      // Readability controls
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
      readabilityCheckLabel.appendChild(
         document.createTextNode(" Include readability link")
      );
      readabilityCheckLabel.appendChild(readabilityCheck);
      
      // Action buttons
      const copyBtn = document.createElement("button");
      copyBtn.className = "citation-button";
      copyBtn.textContent = "Copy to Clipboard";
      copyBtn.id = "copy-button";
      
      const whatsappBtn = document.createElement("button");
      whatsappBtn.className = "citation-button whatsapp";
      whatsappBtn.textContent = "Share on WhatsApp";
      whatsappBtn.id = "whatsapp-button";
      
      const twitterBtn = document.createElement("button");
      twitterBtn.className = "citation-button twitter";
      twitterBtn.textContent = "Share on Twitter/X";
      twitterBtn.id = "twitter-button";
      
      const emailBtn = document.createElement("button");
      emailBtn.className = "citation-button email";
      emailBtn.textContent = "Share via Email";
      emailBtn.id = "email-button";
      
      const readabilityBtn = document.createElement("button");
      readabilityBtn.className = "citation-button readability";
      readabilityBtn.textContent = "View in Readability Service";
      readabilityBtn.id = "readability-button";
      
      const qrBtn = document.createElement("button");
      qrBtn.className = "citation-button qr";
      qrBtn.textContent = "Scan the QR Code";
      qrBtn.id = "qr-button";

      // Footer
      const footer = document.createElement("div");
      footer.className = "citation-footer";

      const versionSpan = document.createElement("span");
      versionSpan.textContent = CONFIG.APP_INFO.version;
      footer.appendChild(versionSpan);
      footer.appendChild(document.createTextNode("|"));

      const creditsLink = document.createElement("a");
      creditsLink.href = "https://linktr.ee/magasine";
      creditsLink.target = "_blank";
      creditsLink.textContent = "by @magasine";
      footer.appendChild(creditsLink);
      footer.appendChild(document.createTextNode("|"));

      const helpLink = document.createElement("a");
      helpLink.href =
        "https://drive.google.com/file/d/1PZcw-Syb1ngz3fudr15LPn5Civqzrnzz/view?usp=sharing";
      helpLink.target = "_blank";
      helpLink.textContent = "Help";
      footer.appendChild(helpLink);

      // Assemble UI
      container.appendChild(modeSelector);
      container.appendChild(preview);
      container.appendChild(clipboardControls);
      container.appendChild(formatLabel);
      container.appendChild(formatSelect);
      container.appendChild(readabilityLabel);
      container.appendChild(readabilitySelect);
      container.appendChild(readabilityCheckLabel);
      container.appendChild(copyBtn);
      container.appendChild(qrBtn);
      container.appendChild(whatsappBtn);
      container.appendChild(twitterBtn);
      container.appendChild(emailBtn);
      container.appendChild(readabilityBtn);
      
      badge.appendChild(header);
      badge.appendChild(container);
      badge.appendChild(footer);
      
      // Event handlers
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
          selectionBtn.classList.toggle("active", state.captureMode === "selection");
          clipboardBtn.classList.toggle("active", state.captureMode === "clipboard");
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
      
      closeBtn.addEventListener("click", () => hostElement.remove());
      
      document.addEventListener("selectionchange", () => {
        if (state.captureMode === "selection") {
          setTimeout(() => {
            const selection = window.getSelection().toString().trim();
            if (selection) preview.textContent = sanitize(selection);
          }, 300);
        }
      });
      
      return badge;
    },
  };

  // Drag functionality
  const dragElement = (element, dragHandle) => {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    const handleMouseDown = (e) => {
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

  // Initialization
  const init = () => {
    console.log(
      `[${CONFIG.APP_INFO.name} DEBUG] init() chamada. CONFIG.HOST_ID: ${CONFIG.HOST_ID}, Versão do script: ${CONFIG.APP_INFO.version}`
    );
    
    const existingHost = document.getElementById(CONFIG.HOST_ID);

    if (existingHost) {
      console.log(
        `[${CONFIG.APP_INFO.name} DEBUG] Host existente encontrado:`,
        existingHost
      );
      try {
        existingHost.remove();
        console.log(
          `[${CONFIG.APP_INFO.name} DEBUG] existingHost.remove() chamado. UI foi fechada.`
        );
        if (document.getElementById(CONFIG.HOST_ID)) {
          console.error(
            `[${CONFIG.APP_INFO.name} DEBUG] ERRO CRÍTICO: Host ainda existe no DOM após remove()! ID: ${CONFIG.HOST_ID}`
          );
        } else {
          console.log(
            `[${CONFIG.APP_INFO.name} DEBUG] SUCESSO: Host não foi encontrado no DOM após remove(). Comportamento de toggle: UI fechada.`
          );
        }
        return;
      } catch (e) {
        console.error(
          `[${CONFIG.APP_INFO.name} DEBUG] Erro ao tentar remover existingHost:`,
          e
        );
        return;
      }
    } else {
      console.log(
        `[${CONFIG.APP_INFO.name} DEBUG] Nenhum host existente encontrado com ID: ${CONFIG.HOST_ID}. Criando um novo para abrir a UI.`
      );
    }

    // Create Shadow DOM host
    const hostElement = document.createElement("div");
    hostElement.id = CONFIG.HOST_ID;
    console.log(
      `[${CONFIG.APP_INFO.name} DEBUG] Novo hostElement criado com ID: ${hostElement.id}`
    );
    document.body.appendChild(hostElement);

    // Initialize Shadow DOM
    const shadow = hostElement.attachShadow({ mode: "open" });
    UI.createStyles(shadow);
    const citationToolElement = UI.createUI(shadow, hostElement);
    shadow.appendChild(citationToolElement);

    // Setup drag functionality
    const headerElement = citationToolElement.querySelector(".citation-header");
    if (headerElement) {
      dragElement(hostElement, headerElement);
    }
    
    console.log(
      `[${CONFIG.APP_INFO.name} DEBUG] Nova UI criada e configurada no host ${hostElement.id}.`
    );
  };

  // Prevent multiple executions
  if (
    window.citationToolInitiated &&
    Date.now() - window.citationToolInitiated < 1000
  ) {
    console.warn(
      `[${CONFIG.APP_INFO.name}] Script chamado novamente em menos de 1 segundo. Ignorando esta chamada para evitar duplicação rápida.`
    );
    return;
  }
  window.citationToolInitiated = Date.now();

  console.log(
    `[${CONFIG.APP_INFO.name} DEBUG] Script principal carregado (Versão: ${CONFIG.APP_INFO.version}).`
  );
  init();
})();

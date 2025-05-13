javascript: (() => {
   // Configurações e constantes
   const CONFIG = {
     BADGE_ID: "citation-tool",
     APP_INFO: {
       name: "Citation Tool",
       version: "v20250512",
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
 
   // Utilitários
   const Utils = {
     copyToClipboard: async (text) => {
       try {
         if (navigator.clipboard?.writeText) {
           await navigator.clipboard.writeText(text);
           return true;
         }
 
         // Fallback para navegadores mais antigos
         const textarea = document.createElement("textarea");
         textarea.value = text;
         textarea.style.position = "fixed";
         document.body.appendChild(textarea);
         textarea.select();
         const success = document.execCommand("copy");
         document.body.removeChild(textarea);
         return success;
       } catch (error) {
         console.error("Copy error:", error);
         return false;
       }
     },
 
     showFeedback: (message, duration = 3000) => {
       let feedback = document.getElementById("citation-feedback");
       if (!feedback) {
         feedback = document.createElement("div");
         feedback.id = "citation-feedback";
         feedback.style.cssText = `
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
          `;
         document.body.appendChild(feedback);
       }
 
       feedback.textContent = message;
       feedback.style.opacity = "1";
       setTimeout(() => (feedback.style.opacity = "0"), duration);
     },
 
     getPageContent: () => {
       const selection = window.getSelection().toString().trim();
       if (selection) return selection;
 
       for (const selector of CONFIG.CONTENT_SELECTORS) {
         const element = document.querySelector(selector);
         if (element) {
           const text = element.textContent.trim();
           return text.length > 280 ? text.substring(0, 280) + "..." : text;
         }
       }
 
       return "No text selected or main content found.";
     },
 
     getClipboardText: async () => {
       try {
         return (
           (await navigator.clipboard?.readText()) ||
           "Clipboard access not supported"
         );
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
 
       const formats = {
         plain: () =>
           `${title}\n\n${separator}\n${text}\n${separator}\n\nSource: ${url}` +
           (includeLink ? `\nReadable: ${serviceUrl}` : ""),
 
         markdown: () =>
           `# ${title}\n\n> ${text.replace(/\n/g, "\n> ")}\n\n[Source](${url})` +
           (includeLink ? `\n\n[Readable](${serviceUrl})` : ""),
 
         html: () =>
           `<blockquote><h2>${title}</h2><p>${text.replace(/\n/g, "<br>")}</p>` +
           `<footer><a href="${url}">Source</a>` +
           (includeLink
             ? ` | <a href="${serviceUrl}">Readable</a></footer></blockquote>`
             : "</footer></blockquote>"),
 
         twitter: () =>
           `"${
             text.length > 240 ? text.substring(0, 240) + "..." : text
           }"\n\n${url}`,
 
         academic: () =>
           `${title}. Retrieved from ${url} on ${new Date().toLocaleDateString()}`,
 
         default: () =>
           `*${title}*\n\n${separator}\n${text}\n${separator}\n\n- Source: ${url}` +
           (includeLink ? `\n- Readable: ${serviceUrl}` : ""),
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
     createStyles: () => {
       const style = document.createElement("style");
       style.textContent = `
          .citation-tool {
            position: fixed;
            top: 10px;
            right: 10px;
            width: 350px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-family: sans-serif;
            z-index: 999999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
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
          
          select, input {
            width: 100%;
            padding: 6px;
            margin: 4px 0;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          
          .window-controls button {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
          }
          
          @media (prefers-color-scheme: dark) {
            .citation-tool { background: #333; color: #fff; border-color: #444; }
            .citation-header { background: #1a4a73; }
            .citation-preview { background: #222; border-color: #444; }
            select, input { background: #444; color: #fff; border-color: #555; }
          }
        `;
       document.head.appendChild(style);
     },
 
     createUI: () => {
       const { pageUrl, pageTitle, selectedText } = {
         pageUrl: location.href,
         pageTitle: document.title || "Untitled",
         selectedText: Utils.getPageContent(),
       };
 
       // Elemento principal
       const badge = document.createElement("div");
       badge.className = "citation-tool";
       badge.id = CONFIG.BADGE_ID;
 
       // Cabeçalho
       const header = document.createElement("div");
       header.className = "citation-header";
 
       const title = document.createElement("h3");
       title.innerHTML = `${CONFIG.APP_INFO.name} <sup style= "color: #bcbcbc;font-size: 0.7em;font-weight: 300;">${CONFIG.APP_INFO.version}</sup)`;
 
       const controls = document.createElement("div");
       controls.className = "window-controls";
 
       const closeBtn = document.createElement("button");
       closeBtn.textContent = "✖";
       closeBtn.onclick = () => badge.remove();
 
       controls.appendChild(closeBtn);
       header.appendChild(title);
       header.appendChild(controls);
 
       // Conteúdo
       const container = document.createElement("div");
       container.className = "citation-container";
 
       // Modo de captura
       const modeSelector = document.createElement("div");
       const modeLabel = document.createElement("label");
       modeLabel.textContent = "Capture Mode:";
       modeSelector.appendChild(modeLabel);
 
       const modeButtons = document.createElement("div");
       modeButtons.style.display = "flex";
       modeButtons.style.margin = "8px 0";
 
       const selectionBtn = document.createElement("button");
       selectionBtn.textContent = "Selection";
       selectionBtn.dataset.mode = "selection";
       selectionBtn.style.flex = "1";
       selectionBtn.style.padding = "6px";
       selectionBtn.style.background =
         state.captureMode === "selection" ? "#296fa7" : "";
       selectionBtn.style.color =
         state.captureMode === "selection" ? "white" : "";
 
       const clipboardBtn = document.createElement("button");
       clipboardBtn.textContent = "Clipboard";
       clipboardBtn.dataset.mode = "clipboard";
       clipboardBtn.style.flex = "1";
       clipboardBtn.style.padding = "6px";
       clipboardBtn.style.background =
         state.captureMode === "clipboard" ? "#296fa7" : "";
       clipboardBtn.style.color =
         state.captureMode === "clipboard" ? "white" : "";
 
       modeButtons.appendChild(selectionBtn);
       modeButtons.appendChild(clipboardBtn);
       modeSelector.appendChild(modeButtons);
 
       // Preview
       const preview = document.createElement("div");
       preview.className = "citation-preview";
       preview.textContent = selectedText;
 
       // Controles de clipboard (visível apenas no modo clipboard)
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
 
       // Formatos
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
 
       // Serviços de legibilidade
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
 
       // Checkbox de legibilidade
       const readabilityCheckLabel = document.createElement("label");
       const readabilityCheck = document.createElement("input");
       readabilityCheck.type = "checkbox";
       readabilityCheck.id = "include-readability";
       readabilityCheck.checked = true;
       readabilityCheckLabel.appendChild(readabilityCheck);
       readabilityCheckLabel.appendChild(
         document.createTextNode(" Include readability link")
       );
 
       // Botões de ação
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
 
       // Footer
       const footer = document.createElement("div");
       footer.style.padding = "8px";
       footer.style.textAlign = "center";
       footer.style.fontSize = "12px";
 
       const creditsLink = document.createElement("a");
       creditsLink.href = "https://linktr.ee/magasine";
       creditsLink.target = "_blank";
       creditsLink.style.color = "inherit";
       creditsLink.textContent = CONFIG.APP_INFO.credits;
       footer.appendChild(creditsLink);
 
       // Montagem da UI
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
 
       // Event listeners
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
 
       // Modos de captura
       [selectionBtn, clipboardBtn].forEach((btn) => {
         btn.onclick = () => {
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
         };
       });
 
       // Clipboard actions
       addClipboardBtn.onclick = async () => {
         const text = await Utils.getClipboardText();
         if (text && !text.includes("Clipboard access")) {
           state.clipboardItems.push(text);
           updatePreview();
           Utils.showFeedback("✓ Added to collection!");
         } else {
           Utils.showFeedback("✗ Could not access clipboard");
         }
       };
 
       clearClipboardBtn.onclick = () => {
         state.clipboardItems = [];
         updatePreview();
         Utils.showFeedback("✓ Collection cleared");
       };
 
       // Botões principais
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
 
       copyBtn.onclick = async () => {
         const success = await Utils.copyToClipboard(getFormattedText());
         Utils.showFeedback(success ? "✓ Copied!" : "✗ Copy failed");
       };
 
       whatsappBtn.onclick = () => {
         Citation.share.whatsapp(getFormattedText());
       };
 
       twitterBtn.onclick = () => {
         Citation.share.twitter(getFormattedText());
       };
 
       emailBtn.onclick = () => {
         Citation.share.email(getFormattedText(), pageTitle);
       };
 
       readabilityBtn.onclick = () => {
         const service = CONFIG.READABILITY_SERVICES[readabilitySelect.value];
         window.open(service.url(pageUrl), "_blank");
       };
 
       qrBtn.onclick = () => {
         Citation.share.qrCode(getFormattedText());
       };
 
       // Monitorar seleção de texto
       document.addEventListener("selectionchange", () => {
         if (state.captureMode === "selection") {
           setTimeout(() => {
             const selection = window.getSelection().toString().trim();
             if (selection) preview.textContent = selection;
           }, 300);
         }
       });
 
       // Arrastar a janela
       const dragElement = (element, dragHandle) => {
         let pos1 = 0,
           pos2 = 0,
           pos3 = 0,
           pos4 = 0;
 
         dragHandle.onmousedown = (e) => {
           e.preventDefault();
           pos3 = e.clientX;
           pos4 = e.clientY;
           document.onmouseup = closeDrag;
           document.onmousemove = elementDrag;
         };
 
         const elementDrag = (e) => {
           e.preventDefault();
           pos1 = pos3 - e.clientX;
           pos2 = pos4 - e.clientY;
           pos3 = e.clientX;
           pos4 = e.clientY;
 
           const newTop = element.offsetTop - pos2 + "px";
           const newLeft = element.offsetLeft - pos1 + "px";
 
           // Manter dentro da janela
           if (
             parseInt(newTop) > 0 &&
             parseInt(newTop) < window.innerHeight - 50
           ) {
             element.style.top = newTop;
           }
           if (
             parseInt(newLeft) > 0 &&
             parseInt(newLeft) < window.innerWidth - 50
           ) {
             element.style.left = newLeft;
           }
         };
 
         const closeDrag = () => {
           document.onmouseup = null;
           document.onmousemove = null;
         };
       };
 
       dragElement(badge, header);
 
       return badge;
     },
   };
 
   // Inicialização
   const init = () => {
     // Remove existing instance if present
     const existing = document.getElementById(CONFIG.BADGE_ID);
     if (existing) return existing.remove();
 
     UI.createStyles();
     document.body.appendChild(UI.createUI());
   };
 
   init();
 })();
 

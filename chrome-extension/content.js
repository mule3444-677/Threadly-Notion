(function() {
    'use strict';

    // --- Configuration --- //
    const PLATFORM_CONFIG = {
        chatgpt: {
            name: 'ChatGPT',
            chatContainer: 'main',
            turnSelector: '[data-testid^="conversation-turn"]',
            userSelector: 'div[data-message-author-role="user"]',
            assistantSelector: 'div[data-message-author-role="assistant"] .markdown',
        },
        claude: {
            name: 'Claude',
            chatContainer: '[data-testid="conversation-turn-list"]',
            turnSelector: 'div[data-testid^="conversation-turn-"]',
            userSelector: 'div[data-testid="chat-user-message-content"]',
            assistantSelector: 'div[data-testid="chat-assistant-message-content"]',
        },
        gemini: {
            name: 'Gemini',
            chatContainer: '.conversation-container',
            turnSelector: '.message',
            userSelector: '.query-text',
            assistantSelector: '.model-response-text',
        },
        grok: {
            name: 'Grok',
            chatContainer: 'div[style*="flex-direction: column;"]',
            turnSelector: 'div[data-testid="chat-message"]',
            userSelector: 'div.user-message',
            assistantSelector: '.message-content',
        },
        'ai-studio': {
            name: 'AI Studio',
            chatContainer: '.chat-history',
            turnSelector: '.chat-turn',
            userSelector: '.user-query',
            assistantSelector: '.model-response',
        },
        perplexity: {
            name: 'Perplexity',
            chatContainer: '.thread-content',
            turnSelector: 'div[class*="Message"]',
            userSelector: 'div[class*="User"] .prose',
            assistantSelector: 'div[class*="Assistant"] .prose',
        },
        unknown: { name: 'Unknown' },
    };

    // --- State --- //
    let currentPlatformId = 'unknown';
    let allMessages = [];
    let observer = null;
    let debouncedUpdate = debounce(updateConversation, 500);

    // --- DOM Elements --- //
    let container, panel, sidebar, closeButton, messageList, searchInput, platformIndicator;

    // --- Platform Detection --- //
    function detectPlatform() {
        const hostname = window.location.hostname;
        const platformMap = {
            'chat.openai.com': 'chatgpt',
            'claude.ai': 'claude',
            'gemini.google.com': 'gemini',
            'grok.com': 'grok',
            'x.ai': 'grok',
            'aistudio.google.com': 'ai-studio',
            'perplexity.ai': 'perplexity'
        };
        return platformMap[hostname] || 'unknown';
    }

    // --- UI Injection --- //
    function injectUI() {
        // Inject Stylesheet
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = chrome.runtime.getURL('sidebar.css');
        document.head.appendChild(link);

        // Main container
        container = document.createElement('div');
        container.id = 'threadly-container';

        // UI HTML
        container.innerHTML = `
            <!-- Expanded Pop-out Panel -->
            <div id="threadly-panel" class="threadly-glass">
                <div class="threadly-header">
                    <h3>Threadly <span class="threadly-platform-indicator"></span></h3>
                    <button class="threadly-close">×</button>
                </div>
                <div class="threadly-content">
                    <div class="threadly-search-container">
                        <input type="text" id="threadly-search-input" placeholder="Search conversation...">
                    </div>
                    <div id="threadly-message-list">
                        <div class="threadly-empty-state">Loading messages...</div>
                    </div>
                </div>
            </div>

            <!-- Collapsed Tab -->
            <div id="threadly-sidebar" class="threadly-glass">
                <div class="threadly-tab-content">Threadly</div>
            </div>
        `;
        document.body.appendChild(container);

        // Get references to elements
        panel = document.getElementById('threadly-panel');
        sidebar = document.getElementById('threadly-sidebar');
        closeButton = panel.querySelector('.threadly-close');
        messageList = panel.querySelector('#threadly-message-list');
        searchInput = panel.querySelector('#threadly-search-input');
        platformIndicator = panel.querySelector('.threadly-platform-indicator');

        platformIndicator.textContent = PLATFORM_CONFIG[currentPlatformId].name;
        
        addEventListeners();
    }

    function addEventListeners() {
        sidebar.addEventListener('click', () => togglePanel(true));
        closeButton.addEventListener('click', () => togglePanel(false));
        searchInput.addEventListener('input', (e) => filterMessages(e.target.value));
        
        // Click outside to close
        document.addEventListener('click', handleClickOutside);
        
        // Prevent clicks inside panel from closing it
        panel.addEventListener('click', (e) => e.stopPropagation());
        
        makeDraggable(sidebar, container);
    }
    
    function handleClickOutside(e) {
        if (container.classList.contains('threadly-expanded') && 
            !container.contains(e.target)) {
            togglePanel(false);
        }
    }
    
    function togglePanel(expand) {
        if (expand) {
            container.classList.add('threadly-expanded');
            updateConversation();
        } else {
            container.classList.remove('threadly-expanded');
        }
    }
    
    // --- Draggable Logic --- //
    function makeDraggable(handle, elementToDrag) {
        let startY, startTop, isDragging = false;

        function onPointerDown(e) {
            // Prevent drag on right-click or if it's not the primary handle
            if (e.button !== 0 || e.target !== handle) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = true;
            handle.classList.add('threadly-dragging');
            handle.setPointerCapture(e.pointerId);

            startY = e.clientY;
            startTop = elementToDrag.offsetTop;

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp, { once: true });
        }

        function onPointerMove(e) {
            if (!isDragging) return;
            
            e.preventDefault();
            const dy = e.clientY - startY;
            const newTop = startTop + dy;

            // Constrain movement within viewport (vertical only)
            const maxTop = window.innerHeight - elementToDrag.offsetHeight;
            const constrainedTop = Math.max(0, Math.min(newTop, maxTop));
            
            elementToDrag.style.top = `${constrainedTop}px`;
            elementToDrag.style.bottom = 'auto'; // override bottom positioning
        }

        function onPointerUp(e) {
            if (!isDragging) return;
            
            isDragging = false;
            handle.classList.remove('threadly-dragging');
            handle.releasePointerCapture(e.pointerId);
            document.removeEventListener('pointermove', onPointerMove);

            // Save position
            const finalPosition = elementToDrag.style.top;
            chrome.storage.local.set({ threadlyPosition: finalPosition });
        }

        handle.addEventListener('pointerdown', onPointerDown);
    }

    async function applySavedPosition() {
        try {
            const data = await chrome.storage.local.get('threadlyPosition');
            if (data.threadlyPosition && container) {
                container.style.top = data.threadlyPosition;
                container.style.bottom = 'auto';
            }
        } catch (error) {
            console.log('Threadly: Could not restore position');
        }
    }


    // --- Chat Extraction & Rendering (Unchanged) --- //
    function extractConversation() {
        const config = PLATFORM_CONFIG[currentPlatformId];
        const extracted = [];
        if (!config.turnSelector) return [];
        const turns = document.querySelectorAll(config.turnSelector);

        turns.forEach(turn => {
            const userEl = turn.querySelector(config.userSelector);
            const assistantEl = turn.querySelector(config.assistantSelector);

            if (userEl && userEl.innerText.trim()) {
                extracted.push({ role: 'user', content: userEl.innerText.trim() });
            }
            if (assistantEl && assistantEl.innerText.trim()) {
                extracted.push({ role: 'assistant', content: assistantEl.innerText.trim() });
            }
        });
        
        if(extracted.length === 0 && (currentPlatformId === 'gemini' || currentPlatformId === 'ai-studio')) {
             const messages = document.querySelectorAll(`${config.userSelector}, ${config.assistantSelector}`);
             messages.forEach(msg => {
                 if (!msg.innerText.trim()) return;
                 const isUser = msg.matches(config.userSelector);
                 extracted.push({ role: isUser ? 'user' : 'assistant', content: msg.innerText.trim() });
             });
        }
        
        return extracted;
    }

    function renderMessages(messagesToRender) {
        if (!messageList) return;
        messageList.innerHTML = '';
        if (messagesToRender.length === 0) {
            messageList.innerHTML = '<div class="threadly-empty-state">No messages found.</div>';
            return;
        }
        const fragment = document.createDocumentFragment();
        messagesToRender.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'threadly-message-item';
            item.dataset.role = msg.role;
            item.innerHTML = `<div class="threadly-message-role">${msg.role}</div><div class="threadly-message-text">${escapeHTML(msg.content)}</div>`;
            fragment.appendChild(item);
        });
        messageList.appendChild(fragment);
    }
    
    function filterMessages(query) {
        query = query.trim().toLowerCase();
        const filtered = !query ? allMessages : allMessages.filter(m => m.content.toLowerCase().includes(query));
        renderMessages(filtered);
    }

    function updateConversation() {
        allMessages = extractConversation();
        if (container.classList.contains('threadly-expanded')) {
            filterMessages(searchInput.value);
        }
    }

    function startObserver() {
        if (observer) observer.disconnect();
        const config = PLATFORM_CONFIG[currentPlatformId];
        const targetNode = document.querySelector(config.chatContainer);
        if (!targetNode) {
            setTimeout(startObserver, 2000);
            return;
        }
        observer = new MutationObserver(() => debouncedUpdate());
        observer.observe(targetNode, { childList: true, subtree: true });
        debouncedUpdate();
    }

    // --- Utilities (Unchanged) --- //
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    function escapeHTML(str) {
        const p = document.createElement('p');
        p.textContent = str;
        return p.innerHTML;
    }

    // --- Initialization --- //
    function init() {
        currentPlatformId = detectPlatform();
        if (currentPlatformId === 'unknown') return;
        injectUI();
        applySavedPosition();
        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

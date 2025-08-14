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
    let isDragging = false; // Add global dragging flag

    // --- DOM Elements --- //
    let container, panel, sidebar, closeButton, exportButton, messageList, searchInput, platformIndicator;

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
        
        // Inject SVG Filter for Glass Effect
        const svgFilter = `
            <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style="position:absolute; overflow:hidden">
                <defs>
                    <filter id="threadly-glass-distortion">
                        <feTurbulence type="fractalNoise" baseFrequency="0.01 0.04" numOctaves="1" seed="2" result="noise" />
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
                    </filter>
                </defs>
            </svg>
        `;
        document.body.insertAdjacentHTML('beforeend', svgFilter);

        // Main container
        container = document.createElement('div');
        container.id = 'threadly-container';

        // UI HTML
        container.innerHTML = `
            <!-- Expanded Pop-out Panel -->
            <div id="threadly-panel" class="threadly-glass">
                <div class="threadly-header">
                    <h3>Threadly <span class="threadly-platform-indicator"></span></h3>
                    <div class="threadly-actions">
                        <button id="threadly-export-btn" class="threadly-button">Export</button>
                        <button class="threadly-close">×</button>
                    </div>
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
        exportButton = document.getElementById('threadly-export-btn');
        messageList = panel.querySelector('#threadly-message-list');
        searchInput = panel.querySelector('#threadly-search-input');
        platformIndicator = panel.querySelector('.threadly-platform-indicator');

        platformIndicator.textContent = PLATFORM_CONFIG[currentPlatformId].name;
        
        addEventListeners();
    }

    function addEventListeners() {
        sidebar.addEventListener('click', () => { if (!isDragging) togglePanel(true); });
        closeButton.addEventListener('click', () => togglePanel(false));
        exportButton.addEventListener('click', exportConversation);
        searchInput.addEventListener('input', (e) => filterMessages(e.target.value));
        messageList.addEventListener('click', handleMessageClick);
        
        // Click outside to close
        document.addEventListener('click', handleClickOutside);
        
        // Prevent clicks inside panel from closing it
        panel.addEventListener('click', (e) => e.stopPropagation());
        
        makeDraggable(container); // Drag the whole container now
    }
    
    // --- UI Interaction & Features --- //

    // **MAJOR UPDATE**: Smart expansion logic
    function togglePanel(expand) {
        if (expand) {
            // 1. Get measurements
            const containerRect = container.getBoundingClientRect();
            const panelHeight = panel.offsetHeight;
            const viewportHeight = window.innerHeight;

            // 2. Calculate available space
            const spaceAbove = containerRect.top;
            const spaceBelow = viewportHeight - containerRect.bottom;

            // 3. Decide expansion direction
            panel.classList.remove('expand-up', 'expand-down');
            
            if (spaceBelow >= panelHeight) {
                // Prefer expanding down if there's enough space
                panel.classList.add('expand-down');
            } else if (spaceAbove >= panelHeight) {
                // Otherwise, expand up if there's enough space
                panel.classList.add('expand-up');
            } else {
                // Fallback: not enough space either way, expand down by default
                panel.classList.add('expand-down');
            }

            container.classList.add('threadly-expanded');
            updateConversation();
        } else {
            container.classList.remove('threadly-expanded');
        }
    }
    
    function handleClickOutside(e) {
        if (container.classList.contains('threadly-expanded') && !container.contains(e.target)) {
            togglePanel(false);
        }
    }

    function handleMessageClick(e) {
        const item = e.target.closest('.threadly-message-item');
        if (!item) return;
        
        const text = item.querySelector('.threadly-message-text').innerText;
        navigator.clipboard.writeText(text).then(() => {
            item.classList.add('copied');
            setTimeout(() => item.classList.remove('copied'), 1500);
        });
    }
    
    function exportConversation() {
        if (allMessages.length === 0) {
            alert('No conversation to export.');
            return;
        }
        
        const json = JSON.stringify(allMessages, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `threadly-export-${currentPlatformId.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // **IMPROVED**: Draggable Logic for X & Y with click/drag separation
    function makeDraggable(elementToDrag) {
        const handle = elementToDrag; // The whole container is the handle now
        let startX, startY, startLeft, startTop;
        let dragTimeout;

        function onPointerDown(e) {
            if (e.target.closest('#threadly-panel')) return; // Don't drag if clicking the panel
            if (e.button !== 0) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            isDragging = false;
            handle.setPointerCapture(e.pointerId);

            startX = e.clientX;
            startY = e.clientY;
            const rect = elementToDrag.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;

            dragTimeout = setTimeout(() => {
                isDragging = true;
                handle.classList.add('threadly-dragging');
            }, 150); // >150ms press is a drag

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp, { once: true });
        }

        function onPointerMove(e) {
            if (!handle.hasPointerCapture(e.pointerId)) return;
            
            if (isDragging) {
                e.preventDefault();
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const newLeft = startLeft + dx;
                const newTop = startTop + dy;
                elementToDrag.style.left = `${Math.max(0, Math.min(newLeft, window.innerWidth - elementToDrag.offsetWidth))}px`;
                elementToDrag.style.top = `${Math.max(0, Math.min(newTop, window.innerHeight - elementToDrag.offsetHeight))}px`;
                elementToDrag.style.right = 'auto';
                elementToDrag.style.bottom = 'auto';
            }
        }

        function onPointerUp(e) {
            clearTimeout(dragTimeout);
            handle.classList.remove('threadly-dragging');
            if(handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId);
            document.removeEventListener('pointermove', onPointerMove);

            if (isDragging) {
                const finalPosition = { top: elementToDrag.style.top, left: elementToDrag.style.left };
                chrome.storage.local.set({ threadlyPosition: finalPosition });
            }
            // Reset isDragging after a short delay to ensure click event fires correctly
            setTimeout(() => { isDragging = false; }, 50);
        }

        handle.addEventListener('pointerdown', onPointerDown);
    }
    
    async function applySavedPosition() {
        try {
            const data = await chrome.storage.local.get('threadlyPosition');
            if (data.threadlyPosition && container) {
                container.style.top = data.threadlyPosition.top;
                container.style.left = data.threadlyPosition.left;
                container.style.right = 'auto';
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

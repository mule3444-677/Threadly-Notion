(function() {
    'use strict';

    // --- Configuration --- //
    // THIS SECTION HAS BEEN UPDATED
    const PLATFORM_CONFIG = {
        chatgpt: {
            name: 'ChatGPT',
            chatContainer: 'main', // This is still correct
            // UPDATED SELECTOR: This is more specific and targets the div containing the actual message text.
            userSelector: 'div[data-message-author-role="user"] .text-base', 
        },
        claude: {
            name: 'Claude',
            chatContainer: '[data-testid="conversation-turn-list"]',
            userSelector: 'div[data-testid="chat-user-message-content"]',
        },
        gemini: {
            name: 'Gemini',
            chatContainer: '.conversation-container',
            userSelector: '.query-text',
        },
        grok: {
            name: 'Grok',
            chatContainer: 'div[style*="flex-direction: column;"]',
            userSelector: 'div.user-message',
        },
        'ai-studio': {
            name: 'AI Studio',
            chatContainer: '.chat-history',
            userSelector: '.user-query',
        },
        perplexity: {
            name: 'Perplexity',
            // UPDATED CONTAINER: The main scrollable area is a more reliable target.
            chatContainer: '#main', 
            // UPDATED SELECTOR: Perplexity now wraps user requests in a div with a class containing "request".
            userSelector: 'div[class*="request"] .prose',
        },
        unknown: { name: 'Unknown' },
    };

    // --- State --- //
    let currentPlatformId = 'unknown';
    let allMessages = []; // This will hold messages with their live element references
    let observer = null;
    let debouncedUpdate = debounce(updateAndSaveConversation, 500);

    // --- DOM Elements --- //
    let container, panel, closeButton, messageList, searchInput, platformIndicator;

    // --- Platform Detection --- //
    function detectPlatform() {
        const hostname = window.location.hostname;
        // Added www.perplexity.ai as a potential hostname
        const platformMap = {
            'chat.openai.com': 'chatgpt',
            'chatgpt.com': 'chatgpt', // Explicitly handle the new domain
            'claude.ai': 'claude',
            'gemini.google.com': 'gemini',
            'grok.com': 'grok',
            'x.ai': 'grok',
            'aistudio.google.com': 'ai-studio',
            'perplexity.ai': 'perplexity',
            'www.perplexity.ai': 'perplexity'
        };
        for (const domain in platformMap) {
            if (hostname.includes(domain)) {
                return platformMap[domain];
            }
        }
        return 'unknown';
    }

    // --- UI Injection (No changes here) --- //
    function injectUI() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = chrome.runtime.getURL('sidebar.css');
        document.head.appendChild(link);

        container = document.createElement('div');
        container.id = 'threadly-container';
        container.innerHTML = `
            <div id="threadly-panel" class="threadly-edge-panel">
                <div class="threadly-tab-content">
                    <span class="threadly-brand">threadly</span>
                </div>
                <div class="threadly-header">
                    <h3><span class="threadly-brand">threadly</span> <span class="threadly-platform-indicator"></span></h3>
                    <button class="threadly-close">×</button>
                </div>
                <div class="threadly-content">
                    <div class="threadly-search-container">
                        <input type="text" id="threadly-search-input" placeholder="Search your prompts...">
                    </div>
                    <div id="threadly-message-list">
                        <div class="threadly-empty-state">Loading messages...</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(container);

        panel = document.getElementById('threadly-panel');
        closeButton = panel.querySelector('.threadly-close');
        messageList = panel.querySelector('#threadly-message-list');
        searchInput = panel.querySelector('#threadly-search-input');
        platformIndicator = panel.querySelector('.threadly-platform-indicator');
        platformIndicator.textContent = PLATFORM_CONFIG[currentPlatformId].name;
        
        addEventListeners();
    }

    // --- Event Listeners (No changes here) --- //
    function addEventListeners() {
        panel.addEventListener('click', (e) => {
            if (e.target.closest('.threadly-close') || e.target.closest('#threadly-search-input') || e.target.closest('.threadly-message-item')) {
                return;
            }
            if (!panel.classList.contains('threadly-expanded')) {
                togglePanel(true);
            }
        });
        
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel(false);
        });
        
        searchInput.addEventListener('input', (e) => filterMessages(e.target.value));
        document.addEventListener('click', handleClickOutside);
    }
    
    function handleClickOutside(e) {
        if (panel.classList.contains('threadly-expanded') && !panel.contains(e.target)) {
            togglePanel(false);
        }
    }

    function togglePanel(expand) {
        if (expand) {
            const panelRect = panel.getBoundingClientRect();
            const newTop = panelRect.top;
            panel.style.top = `${newTop}px`;
            panel.style.bottom = 'auto';
            panel.classList.add('threadly-expanded');
            setTimeout(() => {
                updateAndSaveConversation();
            }, 300);
        } else {
            panel.classList.remove('threadly-expanded');
            panel.style.top = '10vh';
            panel.style.bottom = 'auto';
        }
    }

    // --- Storage Functions (No changes here) --- //
    function getStorageKey() {
        return `threadly_${currentPlatformId}_${window.location.pathname}`;
    }

    async function saveMessagesToStorage(messages) {
        const key = getStorageKey();
        const storableMessages = messages.map(msg => ({ content: msg.content }));
        if (storableMessages.length > 0) {
            await chrome.storage.local.set({ [key]: storableMessages });
        }
    }

    async function loadMessagesFromStorage() {
        const key = getStorageKey();
        const data = await chrome.storage.local.get(key);
        return data[key] || [];
    }

    // --- Chat Extraction (No changes here) --- //
    function extractUserConversation() {
        const config = PLATFORM_CONFIG[currentPlatformId];
        const extracted = [];
        if (!config.userSelector) return [];

        const userElements = document.querySelectorAll(config.userSelector);

        userElements.forEach(userEl => {
            const text = userEl.innerText.trim();
            if (text) {
                extracted.push({
                    role: 'user',
                    content: text,
                    element: userEl
                });
            }
        });
        return extracted;
    }

    // --- Rendering (No changes here) --- //
    function renderMessages(messagesToRender) {
        if (!messageList) return;
        messageList.innerHTML = '';
        if (messagesToRender.length === 0) {
            messageList.innerHTML = '<div class="threadly-empty-state">No user prompts found or saved.</div>';
            return;
        }
        const fragment = document.createDocumentFragment();
        messagesToRender.forEach(msg => {
            const item = document.createElement('div');
            item.className = 'threadly-message-item';
            item.dataset.role = 'user';
            item.innerHTML = `<div class="threadly-message-role">You</div><div class="threadly-message-text">${escapeHTML(msg.content)}</div>`;

            if (msg.element && document.body.contains(msg.element)) {
                item.style.cursor = 'pointer';
                item.title = 'Click to scroll to message';
                item.addEventListener('click', () => {
                    msg.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    const originalBg = msg.element.style.backgroundColor;
                    msg.element.style.transition = 'background-color 0.3s ease';
                    msg.element.style.backgroundColor = 'rgba(0, 191, 174, 0.2)';
                    setTimeout(() => {
                        msg.element.style.backgroundColor = originalBg;
                    }, 1500);
                });
            }
            fragment.appendChild(item);
        });
        messageList.appendChild(fragment);
    }
    
    function filterMessages(query) {
        query = query.trim().toLowerCase();
        const filtered = !query ? allMessages : allMessages.filter(m => m.content.toLowerCase().includes(query));
        renderMessages(filtered);
    }

    // --- Main Update Logic (No changes here) --- //
    function updateAndSaveConversation() {
        const currentMessages = extractUserConversation();
        
        if (currentMessages.length > 0) {
            allMessages = currentMessages;
            saveMessagesToStorage(currentMessages);
        }
        
        if (panel.classList.contains('threadly-expanded')) {
            filterMessages(searchInput.value);
        }
    }

    function startObserver() {
        if (observer) observer.disconnect();
        const config = PLATFORM_CONFIG[currentPlatformId];
        const targetNode = document.querySelector(config.chatContainer);
        if (!targetNode) {
            // Increased timeout for slower loading pages
            setTimeout(startObserver, 3000); 
            return;
        }
        observer = new MutationObserver(() => debouncedUpdate());
        observer.observe(targetNode, { childList: true, subtree: true });
        
        debouncedUpdate();
    }

    // --- Utilities (No changes here) --- //
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

    // --- Initialization (No changes here) --- //
    async function init() {
        currentPlatformId = detectPlatform();
        if (currentPlatformId === 'unknown') return;
        
        injectUI();
        
        const savedMessages = await loadMessagesFromStorage();
        // Combine saved messages with a fresh scan to get element references
        const liveMessages = extractUserConversation();
        
        // A simple way to merge: use live if available, otherwise use saved content
        allMessages = liveMessages.length > 0 ? liveMessages : savedMessages.map(m => ({ content: m.content, element: null }));

        if (panel.classList.contains('threadly-expanded')) {
             renderMessages(allMessages);
        }

        startObserver();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
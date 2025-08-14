(function() {
    'use strict';

    // --- Updated Configuration for 2024/2025 --- //
    const PLATFORM_CONFIG = {
        chatgpt: {
            name: 'ChatGPT',
            chatContainer: 'main',
            // Updated selectors for current ChatGPT structure
            userSelector: 'div[data-message-author-role="user"] .whitespace-pre-wrap, div[data-message-author-role="user"] div[class*="prose"], div[data-message-author-role="user"] .text-base',
        },
        claude: {
            name: 'Claude',
            chatContainer: '[data-testid="conversation-turn-list"], main',
            userSelector: 'div[data-testid="chat-user-message-content"], div[data-testid="user-message"]',
        },
        gemini: {
            name: 'Gemini',
            // Updated container selectors for current Gemini interface
            chatContainer: 'main, .conversation-container, [role="main"], .chat-interface',
            // Updated user selectors for current Gemini structure
            userSelector: '.user-message, [data-role="user"], .query-text, div[class*="user"] p, .user-input-display',
        },
        grok: {
            name: 'Grok',
            chatContainer: 'div[style*="flex-direction: column;"], main',
            userSelector: 'div.user-message, [data-role="user"]',
        },
        'ai-studio': {
            name: 'AI Studio',
            chatContainer: '.chat-history, main',
            userSelector: '.user-query, [data-role="user"]',
        },
        perplexity: {
            name: 'Perplexity',
            // Updated container selectors for current Perplexity interface
            chatContainer: 'main, #__next, .search-interface, [role="main"], .app-main',
            // Updated user selectors for current Perplexity structure  
            userSelector: '.user-query, [data-testid="search-query"], .search-input-value, div[class*="query"] span, .prose:has(p), input[type="text"]:not([class*="search"]):focus',
        },
        unknown: { name: 'Unknown' },
    };

    // --- Enhanced State Management --- //
    let currentPlatformId = 'unknown';
    let allMessages = [];
    let observer = null;
    let debouncedUpdate = debounce(updateAndSaveConversation, 750); // Increased debounce
    let retryCount = 0;
    const MAX_RETRIES = 5;

    // --- DOM Elements --- //
    let container, panel, closeButton, messageList, searchInput, platformIndicator;

    // --- Enhanced Platform Detection --- //
    function detectPlatform() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        
        console.log('Threadly: Detecting platform for', hostname, pathname);
        
        const platformMap = {
            'chat.openai.com': 'chatgpt',
            'chatgpt.com': 'chatgpt',
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
                console.log('Threadly: Platform detected:', platformMap[domain]);
                return platformMap[domain];
            }
        }
        
        console.log('Threadly: Unknown platform');
        return 'unknown';
    }

    // --- Enhanced UI Injection --- //
    function injectUI() {
        // Remove any existing instances
        const existing = document.getElementById('threadly-container');
        if (existing) {
            existing.remove();
        }

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = chrome.runtime.getURL('sidebar.css');
        document.head.appendChild(link);

        container = document.createElement('div');
        container.id = 'threadly-container';
        container.innerHTML = `
            <div id="threadly-panel" class="threadly-edge-panel">
                <div class="threadly-tint-layer"></div>
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

        // Inject SVG glass distortion filter
        injectGlassFilter();

        panel = document.getElementById('threadly-panel');
        closeButton = panel.querySelector('.threadly-close');
        messageList = panel.querySelector('#threadly-message-list');
        searchInput = panel.querySelector('#threadly-search-input');
        platformIndicator = panel.querySelector('.threadly-platform-indicator');
        platformIndicator.textContent = PLATFORM_CONFIG[currentPlatformId].name;
        platformIndicator.setAttribute('data-platform', currentPlatformId);
        
        // Add platform data attribute to panel for CSS targeting
        panel.setAttribute('data-platform', currentPlatformId);
        
        // Platform-specific positioning adjustments
        adjustUIForPlatform();
        
        addEventListeners();
        
        console.log('Threadly: UI injected successfully');
    }

    // --- Glass Filter Injection --- //
    function injectGlassFilter() {
        // Remove any existing glass filter
        const existingFilter = document.getElementById('threadly-glass-filter');
        if (existingFilter) {
            existingFilter.remove();
        }

        // Create SVG element with glass distortion filter
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = 'threadly-glass-filter';
        svg.style.position = 'absolute';
        svg.style.overflow = 'hidden';
        svg.style.width = '0';
        svg.style.height = '0';
        svg.style.top = '-9999px';
        svg.style.left = '-9999px';
        svg.style.zIndex = '-9999';
        
        svg.innerHTML = `
            <defs>
                <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.008" numOctaves="1" seed="92" result="noise" />
                    <feGaussianBlur in="noise" stdDeviation="1" result="blurred" />
                    <feDisplacementMap in="SourceGraphic" in2="blurred" scale="77" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            </defs>
        `;
        
        document.body.appendChild(svg);
        console.log('Threadly: Glass distortion filter injected');
    }

    // --- Platform-Specific UI Adjustments --- //
    function adjustUIForPlatform() {
        if (currentPlatformId === 'gemini') {
            // Fix positioning issues for Gemini
            panel.style.zIndex = '9999';
            panel.style.position = 'fixed';
            panel.style.top = '20vh';
            panel.style.right = '5px';
            
            // Force scrolling fixes on Gemini
            setTimeout(() => {
                const messageList = document.getElementById('threadly-message-list');
                const content = document.querySelector('.threadly-content');
                
                if (messageList) {
                    messageList.style.cssText = `
                        overflow-y: auto !important;
                        max-height: calc(100% - 120px) !important;
                        height: auto !important;
                        flex: 1 !important;
                    `;
                }
                
                if (content) {
                    content.style.cssText = `
                        overflow: visible !important;
                        height: calc(100% - 50px) !important;
                    `;
                }
                
                console.log('Threadly: Applied Gemini-specific scrolling fixes');
                
                // Set up continuous monitoring for Gemini
                if (currentPlatformId === 'gemini') {
                    setInterval(() => {
                        if (messageList && messageList.style.overflowY !== 'auto') {
                            messageList.style.cssText = `
                                overflow-y: auto !important;
                                max-height: calc(100% - 120px) !important;
                                height: auto !important;
                                flex: 1 !important;
                            `;
                        }
                    }, 2000);
                }
            }, 100);
        } else if (currentPlatformId === 'perplexity') {
            // Ensure proper visibility on Perplexity
            panel.style.zIndex = '10000';
            panel.style.right = '10px';
        }
    }

    // --- Event Listeners --- //
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

    // --- Enhanced Storage Functions --- //
    function getStorageKey() {
        const key = `threadly_${currentPlatformId}_${window.location.pathname}`;
        console.log('Threadly: Storage key:', key);
        return key;
    }

    async function saveMessagesToStorage(messages) {
        try {
            const key = getStorageKey();
            const storableMessages = messages.map(msg => ({ 
                content: msg.content,
                timestamp: Date.now()
            }));
            
            if (storableMessages.length > 0) {
                await chrome.storage.local.set({ [key]: storableMessages });
                console.log('Threadly: Saved', storableMessages.length, 'messages for', currentPlatformId);
            }
        } catch (error) {
            console.error('Threadly: Storage save error:', error);
        }
    }

    async function loadMessagesFromStorage() {
        try {
            const key = getStorageKey();
            const data = await chrome.storage.local.get(key);
            const messages = data[key] || [];
            console.log('Threadly: Loaded', messages.length, 'messages for', currentPlatformId);
            return messages;
        } catch (error) {
            console.error('Threadly: Storage load error:', error);
            return [];
        }
    }

    // --- Enhanced Chat Extraction --- //
    function extractUserConversation() {
        const config = PLATFORM_CONFIG[currentPlatformId];
        const extracted = [];
        
        if (!config.userSelector) {
            console.log('Threadly: No user selector for platform:', currentPlatformId);
            return [];
        }

        console.log('Threadly: Extracting messages with selector:', config.userSelector);

        // Try multiple selectors (comma-separated)
        const selectors = config.userSelector.split(',').map(s => s.trim());
        
        for (const selector of selectors) {
            try {
                const userElements = document.querySelectorAll(selector);
                console.log('Threadly: Found', userElements.length, 'elements with selector:', selector);
                
                userElements.forEach((userEl, index) => {
                    let text = '';
                    
                    // Try different text extraction methods
                    if (userEl.textContent) {
                        text = userEl.textContent.trim();
                    } else if (userEl.innerText) {
                        text = userEl.innerText.trim();
                    } else if (userEl.value) {
                        text = userEl.value.trim();
                    }
                    
                    if (text && text.length > 2) { // Minimum length check
                        console.log('Threadly: Extracted message', index + 1, ':', text.substring(0, 50) + '...');
                        extracted.push({
                            role: 'user',
                            content: text,
                            element: userEl
                        });
                    }
                });
                
                if (extracted.length > 0) {
                    break; // Found messages, no need to try other selectors
                }
            } catch (error) {
                console.warn('Threadly: Error with selector', selector, ':', error);
            }
        }
        
        console.log('Threadly: Total extracted messages:', extracted.length);
        return extracted;
    }

    // --- Enhanced Rendering --- //
    function renderMessages(messagesToRender) {
        if (!messageList) return;
        
        messageList.innerHTML = '';
        
        if (messagesToRender.length === 0) {
            messageList.innerHTML = '<div class="threadly-empty-state">No user prompts found. Try interacting with the chat first.</div>';
            return;
        }
        
        const fragment = document.createDocumentFragment();
        messagesToRender.forEach((msg, index) => {
            const item = document.createElement('div');
            item.className = 'threadly-message-item';
            item.dataset.role = 'user';
            
            // Check if message is longer than 10 words
            const wordCount = msg.content.trim().split(/\s+/).length;
            const isLongMessage = wordCount > 10;
            
            item.innerHTML = `
                <div class="threadly-message-role">You (#${index + 1})</div>
                <div class="threadly-message-text">${escapeHTML(msg.content)}</div>
                ${isLongMessage ? '<div class="threadly-read-more">See More</div>' : ''}
            `;

            // Add read more functionality
            if (isLongMessage) {
                const readMoreBtn = item.querySelector('.threadly-read-more');
                const messageText = item.querySelector('.threadly-message-text');
                
                readMoreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (messageText.classList.contains('expanded')) {
                        messageText.classList.remove('expanded');
                        readMoreBtn.textContent = 'See More';
                    } else {
                        messageText.classList.add('expanded');
                        readMoreBtn.textContent = 'See Less';
                    }
                });
            }
            
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
        const filtered = !query ? allMessages : allMessages.filter(m => 
            m.content.toLowerCase().includes(query)
        );
        renderMessages(filtered);
    }

    // --- Enhanced Update Logic --- //
    function updateAndSaveConversation() {
        console.log('Threadly: Updating conversation for', currentPlatformId);
        
        const currentMessages = extractUserConversation();
        
        if (currentMessages.length > 0) {
            allMessages = currentMessages;
            saveMessagesToStorage(currentMessages);
            console.log('Threadly: Updated with', currentMessages.length, 'messages');
        } else {
            console.log('Threadly: No messages found during update');
        }
        
        if (panel && panel.classList.contains('threadly-expanded')) {
            filterMessages(searchInput.value);
        }
    }

    // --- Enhanced Observer with Retry Logic --- //
    function startObserver() {
        if (observer) {
            observer.disconnect();
        }
        
        const config = PLATFORM_CONFIG[currentPlatformId];
        const containerSelectors = config.chatContainer.split(',').map(s => s.trim());
        
        let targetNode = null;
        
        // Try each container selector
        for (const selector of containerSelectors) {
            targetNode = document.querySelector(selector);
            if (targetNode) {
                console.log('Threadly: Found container with selector:', selector);
                break;
            }
        }
        
        if (!targetNode) {
            retryCount++;
            if (retryCount < MAX_RETRIES) {
                console.log('Threadly: Container not found, retrying in 3s... (attempt', retryCount, '/', MAX_RETRIES, ')');
                setTimeout(startObserver, 3000);
                return;
            } else {
                console.error('Threadly: Could not find container after', MAX_RETRIES, 'attempts');
                return;
            }
        }
        
        console.log('Threadly: Starting MutationObserver on:', targetNode);
        
        observer = new MutationObserver((mutations) => {
            const hasRelevantChanges = mutations.some(mutation => 
                mutation.type === 'childList' && 
                (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
            );
            
            if (hasRelevantChanges) {
                debouncedUpdate();
            }
        });
        
        observer.observe(targetNode, { 
            childList: true, 
            subtree: true,
            attributes: false // Reduce noise
        });
        
        // Initial update
        debouncedUpdate();
        retryCount = 0; // Reset retry count on success
    }

    // --- Utilities --- //
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

    // --- Enhanced Initialization --- //
    async function init() {
        console.log('Threadly: Initializing...');
        
        currentPlatformId = detectPlatform();
        if (currentPlatformId === 'unknown') {
            console.log('Threadly: Unknown platform, exiting');
            return;
        }
        
        // Wait a bit more for dynamic platforms
        if (currentPlatformId === 'perplexity' || currentPlatformId === 'gemini') {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        try {
            injectUI();
            
            const savedMessages = await loadMessagesFromStorage();
            const liveMessages = extractUserConversation();
            
            // Prefer live messages if available, otherwise use saved
            allMessages = liveMessages.length > 0 ? liveMessages : 
                        savedMessages.map(m => ({ content: m.content, element: null }));

            if (panel && panel.classList.contains('threadly-expanded')) {
                renderMessages(allMessages);
            }

            startObserver();
            
            console.log('Threadly: Initialization complete for', currentPlatformId);
            
        } catch (error) {
            console.error('Threadly: Initialization error:', error);
        }
    }

    // --- Enhanced Ready State Handling --- //
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(init, 1000); // Extra delay for SPA loading
        });
    } else {
        setTimeout(init, 1000); // Extra delay for SPA loading
    }
    
    // Handle SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('Threadly: URL changed, re-initializing...');
            setTimeout(init, 2000); // Re-initialize on navigation
        }
    }).observe(document, { subtree: true, childList: true });

})();
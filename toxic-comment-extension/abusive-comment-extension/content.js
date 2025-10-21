// Content Script - Runs on social media pages
class ToxicCommentDetector {
    constructor() {
        this.isEnabled = true;
        this.processedComments = new Set();
        this.stats = { checked: 0, blocked: 0 };
        // Prefer 127.0.0.1 over localhost to avoid name resolution quirks
        this.apiEndpoint = 'http://127.0.0.1:5000/predict';
        // Simple concurrency cap to avoid overwhelming the local API
        this.maxConcurrent = 4;
        this.activeRequests = 0;
        
        this.init();
    }

    async init() {
        console.log('🛡️ Toxic Comment Detector initialized');
        
        // Load settings
        await this.loadSettings();
        
        // Start monitoring
        if (this.isEnabled) {
            this.startMonitoring();
        }
        
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'toggleProtection') {
                this.isEnabled = request.enabled;
                if (this.isEnabled) {
                    this.startMonitoring();
                } else {
                    this.stopMonitoring();
                }
            }
        });
    }

    async loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['extensionEnabled', 'dailyStats'], (result) => {
                this.isEnabled = result.extensionEnabled !== false;
                this.stats = result.dailyStats || { checked: 0, blocked: 0 };
                resolve();
            });
        });
    }

    startMonitoring() {
        console.log('🔍 Starting comment monitoring...');
        
        // Initial scan
        this.scanForComments();
        
        // Set up observer for dynamic content
        this.setupObserver();
        
        // Periodic scan for missed comments
        this.scanInterval = setInterval(() => {
            this.scanForComments();
        }, 2000);
    }

    stopMonitoring() {
        console.log('⏹️ Stopping comment monitoring...');
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
        }
        
        // Remove all blur effects
        this.removeAllBlurEffects();
    }

    setupObserver() {
        this.observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if new nodes contain comments
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            shouldScan = true;
                        }
                    });
                }
            });
            
            if (shouldScan) {
                setTimeout(() => this.scanForComments(), 500);
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    scanForComments() {
        const commentSelectors = this.getCommentSelectors();
        let newCommentsFound = 0;

        commentSelectors.forEach(selector => {
            const comments = document.querySelectorAll(selector);
            
            comments.forEach(async (comment) => {
                const commentId = this.generateCommentId(comment);
                
                if (!this.processedComments.has(commentId)) {
                    this.processedComments.add(commentId);
                    newCommentsFound++;
                    
                    const commentText = this.extractCommentText(comment);
                    if (commentText && commentText.length > 3) {
                        // Respect concurrency cap
                        if (this.activeRequests >= this.maxConcurrent) {
                            // Try again a bit later
                            setTimeout(() => this.analyzeComment(comment, commentText), 500);
                        } else {
                            await this.analyzeComment(comment, commentText);
                        }
                    }
                }
            });
        });

        if (newCommentsFound > 0) {
            console.log(`🔍 Scanned ${newCommentsFound} new comments`);
        }
    }

    getCommentSelectors() {
        const hostname = window.location.hostname;
        
        // Platform-specific comment selectors
        const selectors = {
            'www.youtube.com': [
                '#content-text', // YouTube comments
                'yt-formatted-string#content-text',
                '#comment-content #content-text'
            ],
            'www.facebook.com': [
                '[data-testid="comment"]',
                '.x1lliihq', // Facebook comment text
                '[role="article"] span'
            ],
            'www.instagram.com': [
                'span[dir="auto"]', // Instagram comments
                '.C4VMK span'
            ],
            'twitter.com': [
                '[data-testid="tweetText"]',
                '.css-901oao' // Twitter tweet text
            ],
            'www.reddit.com': [
                '.RichTextJSON-root',
                '[data-testid="comment"]',
                '.md p'
            ],
            'www.tiktok.com': [
                '[data-e2e="comment-text"]',
                '.comment-text'
            ]
        };

        return selectors[hostname] || [
            // Generic selectors for other platforms
            '[class*="comment"]',
            '[class*="message"]',
            '[class*="text"]',
            'p', 'span', 'div'
        ];
    }

    generateCommentId(element) {
        // Create unique ID for each comment
        const rect = element.getBoundingClientRect();
        const text = this.extractCommentText(element).substring(0, 50);
        return `${rect.top}-${rect.left}-${text.replace(/\s/g, '')}`;
    }

    extractCommentText(element) {
        // Extract clean text from comment element
        let text = element.textContent || element.innerText || '';
        text = text.trim().replace(/\s+/g, ' ');
        
        // Filter out very short or non-text content
        if (text.length < 3 || /^[@#]\w+$/.test(text)) {
            return '';
        }
        
        return text;
    }

    async analyzeComment(commentElement, commentText) {
        try {
            this.activeRequests++;
            this.stats.checked++;

            console.log('📨 Sending to API:', commentText);

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: commentText })
            });

            if (!response.ok) {
                let errPayload = null;
                try {
                    errPayload = await response.json();
                } catch (e) {
                    try { errPayload = await response.text(); } catch (_) {}
                }
                console.error(`❌ API returned error ${response.status}:`, errPayload);
                return;
            }

            const result = await response.json();

            console.log('📥 API Response:', result);

            if (!result || typeof result.label !== 'string') {
                console.error('❌ Invalid API response:', result);
                return;
            }

            const label = result.label.toLowerCase(); // "toxic"
            const probability = parseFloat(result.probability) || 0;
            const isToxic = label === 'toxic';

            if (isToxic && probability > 0.5) {
                this.blurToxicComment(commentElement, commentText, probability, result.alternatives);
                this.stats.blocked++;
            }

            this.saveStats();

        } catch (error) {
            console.error('❌ Error during analyzeComment():', error && (error.message || error));
            console.error('Comment text was:', commentText);
        } finally {
            this.activeRequests = Math.max(0, this.activeRequests - 1);
        }
    }


    blurToxicComment(commentElement, originalText, toxicityScore) {
        // Avoid double processing
        if (commentElement.classList.contains('blurred-toxic')) return;

        // Blur the comment directly
        commentElement.style.filter = "blur(5px)";
        commentElement.style.transition = "filter 0.3s ease";
        commentElement.classList.add('blurred-toxic');

        // Create the toggle button
        const toggleButton = document.createElement('button');
        toggleButton.innerText = "Show";
        toggleButton.style.marginLeft = "8px";
        toggleButton.style.background = "#d33";
        toggleButton.style.color = "#fff";
        toggleButton.style.border = "none";
        toggleButton.style.padding = "3px 6px";
        toggleButton.style.borderRadius = "4px";
        toggleButton.style.cursor = "pointer";
        toggleButton.style.fontSize = "12px";

        // Insert the toggle button next to the comment
        commentElement.parentNode.insertBefore(toggleButton, commentElement.nextSibling);

        // Add toggle behavior
        let isBlurred = true;
        toggleButton.addEventListener("click", () => {
            if (isBlurred) {
                commentElement.style.filter = "none";
                toggleButton.innerText = "Hide";
            } else {
                commentElement.style.filter = "blur(5px)";
                toggleButton.innerText = "Show";
            }
            isBlurred = !isBlurred;
        });
    }


    removeAllBlurEffects() {
        const wrappers = document.querySelectorAll('.toxic-comment-wrapper');
        wrappers.forEach(wrapper => {
            const original = wrapper.querySelector(':not(.toxic-comment-overlay):not(.toxic-comment-toggle)');
            if (original) {
                wrapper.parentNode.insertBefore(original, wrapper);
            }
            wrapper.remove();
        });
    }

    saveStats() {
        chrome.storage.local.set({
            'dailyStats': this.stats
        });
    }
}

// Initialize the detector when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ToxicCommentDetector();
    });
} else {
    new ToxicCommentDetector();
}
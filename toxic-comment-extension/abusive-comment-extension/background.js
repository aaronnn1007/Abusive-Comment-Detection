// Background Script - Handles extension lifecycle
chrome.runtime.onInstalled.addListener((details) => {
    console.log('🛡️ Abusive Comment Detector installed!');
    
    // Set default settings
    chrome.storage.local.set({
        'extensionEnabled': true,
        'dailyStats': { checked: 0, blocked: 0 }
    });
    
    // Don't show notification on install to avoid permission issues
    console.log('Extension ready!');
});

// Reset daily stats at midnight
function resetDailyStats() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
        chrome.storage.local.set({
            'dailyStats': { checked: 0, blocked: 0 }
        });
        
        // Set up for next day
        resetDailyStats();
    }, msUntilMidnight);
}

// Start the daily reset cycle
resetDailyStats();

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup (defined in manifest.json)
    console.log('Extension icon clicked');
});

// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const supportedSites = [
            'youtube.com',
            'facebook.com', 
            'instagram.com',
            'twitter.com',
            'reddit.com',
            'tiktok.com'
        ];
        
        const isSupportedSite = supportedSites.some(site => tab.url.includes(site));
        
        if (isSupportedSite) {
            console.log(`🔍 Supported site detected: ${tab.url}`);
            
            // Update icon to show active state
            chrome.action.setBadgeText({
                tabId: tabId,
                text: '🛡️'
            });
            
            chrome.action.setBadgeBackgroundColor({
                tabId: tabId,
                color: '#4CAF50'
            });
        }
    }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStats') {
        // Update extension badge with blocked count
        chrome.action.setBadgeText({
            tabId: sender.tab.id,
            text: request.blockedCount.toString()
        });
        
        chrome.action.setBadgeBackgroundColor({
            tabId: sender.tab.id,
            color: request.blockedCount > 0 ? '#ff4444' : '#4CAF50'
        });
    }
    
    if (request.action === 'showNotification') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Toxic Comment Detected',
            message: `Blocked ${request.count} toxic comment(s) on this page`
        });
    }
});

console.log('🛡️ Toxic Comment Detector background script loaded');
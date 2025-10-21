document.addEventListener('DOMContentLoaded', function() {
    const toggleSwitch = document.getElementById('toggleSwitch');
    const testBtn = document.getElementById('testBtn');
    const testInput = document.getElementById('testInput');
    const testResult = document.getElementById('testResult');
    const checkedCount = document.getElementById('checkedCount');
    const blockedCount = document.getElementById('blockedCount');
    const protectionRate = document.getElementById('protectionRate');

    // Load saved settings and stats
    loadSettings();
    loadStats();

    // Toggle switch functionality
    toggleSwitch.addEventListener('click', function() {
        toggleSwitch.classList.toggle('active');
        const isEnabled = toggleSwitch.classList.contains('active');
        
        // Save setting
        chrome.storage.local.set({ 'extensionEnabled': isEnabled });
        
        // Send message to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'toggleProtection',
                enabled: isEnabled
            });
        });
    });

    // Test toxicity functionality
    testBtn.addEventListener('click', async function() {
        const text = testInput.value.trim();
        if (!text) {
            alert('Please enter some text to test');
            return;
        }

        testBtn.disabled = true;
        testBtn.textContent = 'Checking...';
        
        try {
            // Call your toxicity detection API
            const toxicityResult = await checkToxicity(text);
            displayTestResult(toxicityResult);
        } catch (error) {
            console.error('Error checking toxicity:', error);
            testResult.style.display = 'block';
            testResult.className = 'toxic-result';
            testResult.textContent = 'Error checking toxicity. Please try again.';
        }
        
        testBtn.disabled = false;
        testBtn.textContent = 'Check Toxicity';
    });

    function loadSettings() {
        chrome.storage.local.get(['extensionEnabled'], function(result) {
            const isEnabled = result.extensionEnabled !== false; // Default to true
            if (isEnabled) {
                toggleSwitch.classList.add('active');
            } else {
                toggleSwitch.classList.remove('active');
            }
        });
    }

    function loadStats() {
        chrome.storage.local.get(['dailyStats'], function(result) {
            const stats = result.dailyStats || { checked: 0, blocked: 0 };
            checkedCount.textContent = stats.checked;
            blockedCount.textContent = stats.blocked;
            
            const rate = stats.checked > 0 ? ((stats.blocked / stats.checked) * 100).toFixed(2) : 0;
            protectionRate.textContent = rate + '%';
        });
    }

    async function checkToxicity(text) {
        // Assuming your API runs on localhost:5000 - adjust port if needed
        const response = await fetch('http://localhost:5000/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const result = await response.json();
        return result;
    }

    function displayTestResult(result) {
        testResult.style.display = 'block';
        
        console.log('API Response:', result); // Debug log
        
        // Handle your specific API response format: {label: "toxic"/"non-toxic", probability: 0.8543}
        const label = result.label;
        const probability = result.probability || 0;
        const isToxic = label === 'toxic';
        
        if (isToxic) {
            testResult.className = 'toxic-result';
            testResult.innerHTML = `
                <strong>⚠️ Toxic Content Detected</strong><br>
                Label: ${label}<br>
                Confidence: ${(probability * 100).toFixed(2)}%<br>
                ${result.alternatives ? '<br><strong>Suggested alternatives:</strong><br>' + result.alternatives.join('<br>') : ''}
            `;
        } else {
            testResult.className = 'clean-result';
            testResult.innerHTML = `
                <strong>✅ Content is Clean</strong><br>
                Label: ${label}<br>
                Confidence: ${(probability * 100).toFixed(2)}%
            `;
        }
    }
});
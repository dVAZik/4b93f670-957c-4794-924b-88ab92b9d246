// ==================== MAIN APPLICATION ====================
// Global variables
let currentUser = null;
let telegram = null;
let apiBaseUrl = '';
let refreshInterval = null;

// Initialize Telegram WebApp
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Telegram
    if (window.Telegram && window.Telegram.WebApp) {
        telegram = window.Telegram.WebApp;
        telegram.ready();
        telegram.expand();
        
        // Set theme
        document.body.style.background = telegram.themeParams.bg_color || '#0a0c0f';
    }
    
    // Get user ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user');
    
    if (!userId) {
        showNotification('Ошибка: пользователь не найден', 'error');
        return;
    }
    
    // Load user data
    loadUserData(userId);
    
    // Start refresh interval (every 30 seconds)
    refreshInterval = setInterval(() => {
        if (currentUser) {
            loadUserData(currentUser.id, true);
        }
    }, 30000);
    
    // Add event listeners
    setupEventListeners();
});

// Load user data from server
async function loadUserData(userId, silent = false) {
    try {
        if (!silent) {
            showLoading(true);
        }
        
        const response = await fetch(`/api/user/${userId}`, {
            headers: {
                'X-Telegram-Auth': 'true'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load user data');
        }
        
        const userData = await response.json();
        currentUser = userData;
        
        // Update UI
        updateUI();
        
        // Generate client hash for verification
        if (anticheat) {
            const clientHash = anticheat.generateClientHash(userData);
            // Verify with server
            if (clientHash !== userData.hash) {
                console.warn('Client hash mismatch');
            }
        }
        
        if (!silent) {
            showLoading(false);
        }
    } catch (error) {
        console.error('Error loading user:', error);
        if (!silent) {
            showNotification('Ошибка загрузки данных', 'error');
            showLoading(false);
        }
    }
}

// Update UI with current user data
function updateUI() {
    if (!currentUser) return;
    
    // Update username
    document.getElementById('username').textContent = currentUser.username;
    
    // Update mask
    document.getElementById('mask').textContent = `🎭 #${currentUser.mask_id}`;
    
    // Update balances
    document.getElementById('code-balance').textContent = formatNumber(currentUser.code_balance);
    document.getElementById('hack-balance').textContent = formatNumber(currentUser.hack_balance);
    
    // Update energy
    const energyPercent = (currentUser.energy / currentUser.max_energy) * 100;
    document.getElementById('energy-bar').style.width = `${energyPercent}%`;
    document.getElementById('energy-text').textContent = `${currentUser.energy}/${currentUser.max_energy} ⚡`;
    
    // Update passive income
    document.getElementById('passive-income').textContent = 
        `Доход в час: ${formatNumber(currentUser.passive_income)} $CODE`;
    
    // Update all pages
    updatePageSpecificUI();
}

// Format numbers with commas
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

// Show/hide loading spinner
function showLoading(show) {
    let loader = document.querySelector('.loading-spinner');
    
    if (show) {
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'loading-spinner';
            document.body.appendChild(loader);
        }
    } else {
        if (loader) {
            loader.remove();
        }
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Set color based on type
    switch(type) {
        case 'success':
            notification.style.background = '#2ea44f';
            break;
        case 'error':
            notification.style.background = '#ff4d4d';
            break;
        case 'warning':
            notification.style.background = '#fbbf24';
            notification.style.color = '#000';
            break;
        default:
            notification.style.background = '#1e2329';
            notification.style.color = '#00ff9d';
    }
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Navigation
function navigateTo(page) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.dataset.active = 'false';
    });
    
    const navItem = event.currentTarget;
    navItem.dataset.active = 'true';
    
    // Navigate
    window.location.href = `/${page}?user=${currentUser?.id}`;
}

// Setup event listeners
function setupEventListeners() {
    // Handle back button
    window.addEventListener('popstate', function() {
        location.reload();
    });
    
    // Handle visibility change (prevent background cheating)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Pause any active timers
            console.log('App hidden');
        } else {
            // Refresh data
            if (currentUser) {
                loadUserData(currentUser.id, true);
            }
        }
    });
}

// Page-specific UI updates
function updatePageSpecificUI() {
    const path = window.location.pathname;
    
    switch(path) {
        case '/upgrades':
            if (typeof loadUpgrades === 'function') {
                loadUpgrades();
            }
            break;
        case '/exchange':
            if (typeof loadExchangeRate === 'function') {
                loadExchangeRate();
            }
            break;
        case '/p2p':
            if (typeof loadP2POrders === 'function') {
                loadP2POrders();
            }
            break;
        case '/leaderboard':
            if (typeof loadLeaderboard === 'function') {
                loadLeaderboard();
            }
            break;
        case '/chat':
            if (typeof loadChat === 'function') {
                loadChat();
            }
            break;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    if (anticheat) {
        anticheat.cleanup();
    }
});

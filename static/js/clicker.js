// ==================== CLICKER MECHANICS ====================

let isClicking = false;
let clickCooldown = false;
let clickQueue = [];

// Handle click on main button
async function handleClick() {
    // Anti-cheat check
    if (!anticheat.recordClick()) {
        showNotification('Чит-система: слишком быстрые клики', 'warning');
        return;
    }
    
    if (!currentUser) {
        showNotification('Ошибка: пользователь не найден', 'error');
        return;
    }
    
    if (clickCooldown) {
        // Queue click for after cooldown
        clickQueue.push(Date.now());
        return;
    }
    
    if (currentUser.energy <= 0) {
        showNotification('Нет энергии! Подождите восстановления', 'warning');
        return;
    }
    
    // Visual feedback
    const clicker = document.getElementById('clicker');
    clicker.style.transform = 'scale(0.9)';
    setTimeout(() => {
        clicker.style.transform = 'scale(1)';
    }, 100);
    
    // Add click particle
    createClickParticle();
    
    // Process click
    await processClick();
}

// Process click on server
async function processClick() {
    clickCooldown = true;
    
    try {
        const clickTime = Date.now();
        const clientHash = anticheat ? anticheat.userHash : '';
        
        const response = await fetch('/api/click', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                timestamp: Math.floor(clickTime / 1000),
                hash: clientHash
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 403) {
                // Cheat detected
                showNotification('🚫 Чит-система: ' + data.reason, 'error');
                anticheat.reportViolation('server_rejected', data.reason);
            } else if (response.status === 429) {
                // Rate limited
                showNotification('⚠️ ' + data.warning, 'warning');
            } else {
                showNotification('Ошибка: ' + data.error, 'error');
            }
            return;
        }
        
        // Update user data
        if (data.success) {
            currentUser.code_balance = data.new_balance;
            currentUser.energy = data.energy;
            currentUser.hash = data.hash;
            
            // Update UI
            updateUI();
            
            // Show floating reward
            showFloatingReward(data.reward);
        }
        
    } catch (error) {
        console.error('Click error:', error);
        showNotification('Ошибка соединения', 'error');
    } finally {
        clickCooldown = false;
        
        // Process queued clicks
        if (clickQueue.length > 0) {
            clickQueue = [];
            handleClick();
        }
    }
}

// Create click particle effect
function createClickParticle() {
    const clicker = document.getElementById('clicker');
    const rect = clicker.getBoundingClientRect();
    
    for (let i = 0; i < 5; i++) {
        const particle = document.createElement('div');
        particle.className = 'click-particle';
        
        // Random position around clicker
        const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 100;
        const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * 100;
        
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.backgroundColor = i % 2 === 0 ? '#00ff9d' : '#3b82f6';
        
        document.body.appendChild(particle);
        
        // Remove after animation
        setTimeout(() => {
            particle.remove();
        }, 1000);
    }
}

// Show floating reward text
function showFloatingReward(amount) {
    const clicker = document.getElementById('clicker');
    const rect = clicker.getBoundingClientRect();
    
    const reward = document.createElement('div');
    reward.className = 'floating-reward';
    reward.textContent = `+${amount} $CODE`;
    reward.style.left = rect.left + rect.width / 2 + 'px';
    reward.style.top = rect.top + 'px';
    
    document.body.appendChild(reward);
    
    setTimeout(() => {
        reward.remove();
    }, 1500);
}

// Add CSS for particles
const style = document.createElement('style');
style.textContent = `
    .click-particle {
        position: fixed;
        width: 4px;
        height: 4px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 1000;
        animation: particle-fade 1s ease-out forwards;
    }
    
    @keyframes particle-fade {
        0% {
            opacity: 1;
            transform: scale(1);
        }
        100% {
            opacity: 0;
            transform: scale(0) translateY(-50px);
        }
    }
    
    .floating-reward {
        position: fixed;
        color: #00ff9d;
        font-weight: bold;
        text-shadow: 0 0 10px #00ff9d;
        pointer-events: none;
        z-index: 1000;
        animation: reward-float 1.5s ease-out forwards;
        transform: translateX(-50%);
    }
    
    @keyframes reward-float {
        0% {
            opacity: 1;
            transform: translate(-50%, 0);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -50px);
        }
    }
`;
document.head.appendChild(style);

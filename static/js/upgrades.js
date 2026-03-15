// ==================== УЛУЧШЕНИЯ ====================

let availableUpgrades = [];

// Load upgrades
async function loadUpgrades() {
    try {
        const response = await fetch(`/api/upgrades?user_id=${currentUser.id}`);
        const data = await response.json();
        
        availableUpgrades = data;
        renderUpgrades();
    } catch (error) {
        console.error('Failed to load upgrades:', error);
    }
}

// Render upgrades by category
function renderUpgrades() {
    const container = document.getElementById('upgrades-container');
    if (!container) return;
    
    const software = availableUpgrades.filter(u => u.category === 'software');
    const hardware = availableUpgrades.filter(u => u.category === 'hardware');
    const scripts = availableUpgrades.filter(u => u.category === 'script');
    
    let html = '';
    
    if (software.length > 0) {
        html += '<h3 class="category-title">💻 ПРОГРАММНОЕ ОБЕСПЕЧЕНИЕ</h3>';
        html += renderUpgradeCards(software);
    }
    
    if (hardware.length > 0) {
        html += '<h3 class="category-title">🖥️ ЖЕЛЕЗО</h3>';
        html += renderUpgradeCards(hardware);
    }
    
    if (scripts.length > 0) {
        html += '<h3 class="category-title">📜 СКРИПТЫ</h3>';
        html += renderUpgradeCards(scripts);
    }
    
    container.innerHTML = html;
}

// Render upgrade cards
function renderUpgradeCards(upgrades) {
    let html = '<div class="upgrades-grid">';
    
    upgrades.forEach(upg => {
        const canAfford = currentUser.code_balance >= upg.price;
        const meetsLevel = currentUser.level >= upg.level_required;
        
        html += `
            <div class="upgrade-card ${upg.owned ? 'owned' : ''} ${!meetsLevel ? 'locked' : ''}" data-id="${upg.id}">
                <div class="upgrade-icon">${upg.icon}</div>
                <div class="upgrade-info">
                    <div class="upgrade-name">${upg.name}</div>
                    <div class="upgrade-desc">${upg.description}</div>
                    <div class="upgrade-stats">
                        ${upg.income_per_hour > 0 ? `<span class="stat">📈 +${upg.income_per_hour}/час</span>` : ''}
                        ${upg.click_bonus > 0 ? `<span class="stat">🖱️ +${upg.click_bonus}/клик</span>` : ''}
                    </div>
                    <div class="upgrade-price ${!canAfford ? 'cannot-afford' : ''}">
                        💰 ${upg.price} $CODE
                    </div>
                    ${!meetsLevel ? `<div class="level-req">Требуется уровень ${upg.level_required}</div>` : ''}
                </div>
                ${!upg.owned && meetsLevel ? 
                    `<button class="buy-upgrade-btn" onclick="buyUpgrade(${upg.id})" ${!canAfford ? 'disabled' : ''}>
                        ${canAfford ? 'КУПИТЬ' : 'НЕДОСТАТОЧНО'}
                    </button>` : 
                    upg.owned ? '<div class="owned-label">✅ КУПЛЕНО</div>' : ''
                }
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

// Buy upgrade
async function buyUpgrade(upgradeId) {
    const upgrade = availableUpgrades.find(u => u.id === upgradeId);
    
    if (!upgrade) return;
    
    if (upgrade.owned) {
        showNotification('Улучшение уже куплено', 'warning');
        return;
    }
    
    if (currentUser.level < upgrade.level_required) {
        showNotification(`Требуется уровень ${upgrade.level_required}`, 'warning');
        return;
    }
    
    if (currentUser.code_balance < upgrade.price) {
        showNotification('Недостаточно $CODE', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/buy_upgrade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                upgrade_id: upgradeId
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.code_balance = data.new_balance;
            currentUser.passive_income = data.passive_income;
            
            // Mark as owned
            upgrade.owned = true;
            
            updateUI();
            renderUpgrades();
            showNotification(`${upgrade.name} куплено!`, 'success');
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Buy upgrade error:', error);
        showNotification('Ошибка при покупке', 'error');
    } finally {
        showLoading(false);
    }
}

// Add CSS for upgrades
const upgradeStyle = document.createElement('style');
upgradeStyle.textContent = `
    .upgrades-container {
        padding: 16px;
    }
    
    .category-title {
        color: #00ff9d;
        margin: 20px 0 10px;
        font-size: 18px;
        text-transform: uppercase;
        letter-spacing: 2px;
    }
    
    .upgrades-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 30px;
    }
    
    .upgrade-card {
        background: #1e2329;
        border: 1px solid #2d333b;
        border-radius: 12px;
        padding: 16px;
        position: relative;
        transition: all 0.3s ease;
    }
    
    .upgrade-card:hover {
        border-color: #00ff9d;
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.2);
        transform: translateY(-2px);
    }
    
    .upgrade-card.owned {
        border-color: #2ea44f;
        opacity: 0.8;
    }
    
    .upgrade-card.locked {
        opacity: 0.5;
        filter: grayscale(0.5);
    }
    
    .upgrade-icon {
        font-size: 32px;
        margin-bottom: 10px;
    }
    
    .upgrade-name {
        font-size: 18px;
        font-weight: bold;
        color: #00ff9d;
        margin-bottom: 5px;
    }
    
    .upgrade-desc {
        color: #8b949e;
        font-size: 12px;
        margin-bottom: 10px;
    }
    
    .upgrade-stats {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
    }
    
    .stat {
        background: #0a0c0f;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        color: #e0e0e0;
    }
    
    .upgrade-price {
        font-size: 16px;
        font-weight: bold;
        color: #00ff9d;
        margin-bottom: 10px;
    }
    
    .upgrade-price.cannot-afford {
        color: #ff4d4d;
    }
    
    .buy-upgrade-btn {
        width: 100%;
        padding: 10px;
        background: #00ff9d;
        border: none;
        border-radius: 6px;
        color: #0a0c0f;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .buy-upgrade-btn:hover:not(:disabled) {
        background: #00cc7a;
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.3);
    }
    
    .buy-upgrade-btn:disabled {
        background: #4a4a4a;
        cursor: not-allowed;
        opacity: 0.5;
    }
    
    .owned-label {
        text-align: center;
        color: #2ea44f;
        font-weight: bold;
        padding: 10px;
    }
    
    .level-req {
        color: #fbbf24;
        font-size: 11px;
        margin-top: 5px;
    }
`;
document.head.appendChild(upgradeStyle);

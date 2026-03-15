// ==================== КРИПТОБИРЖА ====================

let currentRate = 100;
let rateTrend = 'up';
let rateHistory = [];

// Load exchange rate
async function loadExchangeRate() {
    try {
        const response = await fetch('/api/exchange/rate');
        const data = await response.json();
        
        currentRate = data.rate;
        rateTrend = data.trend;
        
        updateExchangeUI();
    } catch (error) {
        console.error('Failed to load exchange rate:', error);
    }
}

// Update exchange UI
function updateExchangeUI() {
    const rateElement = document.getElementById('exchange-rate');
    if (rateElement) {
        rateElement.textContent = `1 $HACK = ${currentRate} $CODE`;
        rateElement.className = rateTrend === 'up' ? 'text-success' : 'text-danger';
    }
    
    // Add arrow indicator
    const trendElement = document.getElementById('rate-trend');
    if (trendElement) {
        trendElement.textContent = rateTrend === 'up' ? '▲' : '▼';
        trendElement.className = rateTrend === 'up' ? 'text-success' : 'text-danger';
    }
    
    // Update mini chart
    updateRateChart();
}

// Update rate chart
function updateRateChart() {
    rateHistory.push({
        rate: currentRate,
        time: new Date().toLocaleTimeString()
    });
    
    if (rateHistory.length > 20) {
        rateHistory.shift();
    }
    
    const chartContainer = document.getElementById('rate-chart');
    if (!chartContainer) return;
    
    const maxRate = Math.max(...rateHistory.map(r => r.rate));
    const minRate = Math.min(...rateHistory.map(r => r.rate));
    const range = maxRate - minRate || 1;
    
    let chartHTML = '<div class="rate-chart">';
    rateHistory.forEach((point, i) => {
        const height = ((point.rate - minRate) / range) * 100;
        chartHTML += `<div class="chart-bar" style="height: ${height}%; background: ${point.rate > (rateHistory[i-1]?.rate || point.rate) ? '#00ff9d' : '#ff4d4d'}"></div>`;
    });
    chartHTML += '</div>';
    
    chartContainer.innerHTML = chartHTML;
}

// Buy HACK
async function buyHack() {
    const amount = parseFloat(document.getElementById('buy-amount').value);
    
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'warning');
        return;
    }
    
    if (amount > currentUser.code_balance) {
        showNotification('Недостаточно $CODE', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/exchange/buy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                amount: amount
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.code_balance = data.code_balance;
            currentUser.hack_balance = data.hack_balance;
            
            updateUI();
            showNotification(`Куплено ${data.hack_received.toFixed(4)} $HACK`, 'success');
            
            // Update rate
            await loadExchangeRate();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Buy error:', error);
        showNotification('Ошибка при покупке', 'error');
    } finally {
        showLoading(false);
    }
}

// Sell HACK
async function sellHack() {
    const amount = parseFloat(document.getElementById('sell-amount').value);
    
    if (!amount || amount <= 0) {
        showNotification('Введите корректную сумму', 'warning');
        return;
    }
    
    if (amount > currentUser.hack_balance) {
        showNotification('Недостаточно $HACK', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/exchange/sell', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                amount: amount
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.code_balance = data.code_balance;
            currentUser.hack_balance = data.hack_balance;
            
            updateUI();
            showNotification(`Продано ${amount} $HACK за ${data.code_received.toFixed(2)} $CODE`, 'success');
            
            // Update rate
            await loadExchangeRate();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Sell error:', error);
        showNotification('Ошибка при продаже', 'error');
    } finally {
        showLoading(false);
    }
}

// Initialize exchange page
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('exchange')) {
        loadExchangeRate();
        
        // Refresh rate every 10 seconds
        setInterval(loadExchangeRate, 10000);
        
        // Add event listeners
        document.getElementById('buy-btn')?.addEventListener('click', buyHack);
        document.getElementById('sell-btn')?.addEventListener('click', sellHack);
    }
});

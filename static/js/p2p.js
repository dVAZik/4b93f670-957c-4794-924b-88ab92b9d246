// ==================== P2P РЫНОК ====================

let activeOrders = [];

// Load P2P orders
async function loadP2POrders() {
    try {
        const response = await fetch('/api/p2p/orders');
        const data = await response.json();
        
        activeOrders = data;
        renderP2POrders();
    } catch (error) {
        console.error('Failed to load P2P orders:', error);
    }
}

// Render P2P orders
function renderP2POrders() {
    const container = document.getElementById('orders-list');
    if (!container) return;
    
    if (activeOrders.length === 0) {
        container.innerHTML = '<div class="no-orders">Нет активных ордеров</div>';
        return;
    }
    
    let html = '';
    activeOrders.forEach(order => {
        html += `
            <div class="order-card" data-order-id="${order.id}">
                <div class="order-header">
                    <span class="seller">👤 ${order.seller}</span>
                    <span class="amount">${order.amount} $HACK</span>
                </div>
                <div class="order-details">
                    <div class="price">Цена: ${order.price_per_unit} $CODE</div>
                    <div class="total">Всего: ${order.total} $CODE</div>
                </div>
                <button class="buy-order-btn" onclick="buyFromOrder(${order.id})">
                    КУПИТЬ
                </button>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Create new order
async function createOrder() {
    const amount = parseFloat(document.getElementById('order-amount').value);
    const price = parseFloat(document.getElementById('order-price').value);
    
    if (!amount || amount <= 0 || !price || price <= 0) {
        showNotification('Введите корректные значения', 'warning');
        return;
    }
    
    if (amount < 10) {
        showNotification('Минимальная сумма: 10 $HACK', 'warning');
        return;
    }
    
    if (amount > currentUser.hack_balance) {
        showNotification('Недостаточно $HACK', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/p2p/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                amount: amount,
                price: price
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Ордер создан', 'success');
            document.getElementById('order-amount').value = '';
            document.getElementById('order-price').value = '';
            
            // Refresh user data
            await loadUserData(currentUser.id, true);
            
            // Refresh orders
            await loadP2POrders();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Create order error:', error);
        showNotification('Ошибка при создании ордера', 'error');
    } finally {
        showLoading(false);
    }
}

// Buy from order
async function buyFromOrder(orderId) {
    const order = activeOrders.find(o => o.id === orderId);
    
    if (!order) {
        showNotification('Ордер не найден', 'error');
        return;
    }
    
    if (order.seller === currentUser.username) {
        showNotification('Нельзя купить свой ордер', 'warning');
        return;
    }
    
    if (currentUser.code_balance < order.total) {
        showNotification(`Недостаточно $CODE. Нужно: ${order.total}`, 'error');
        return;
    }
    
    // Confirm purchase
    if (!confirm(`Купить ${order.amount} $HACK за ${order.total} $CODE?`)) {
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/p2p/buy/${orderId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(data.message, 'success');
            
            // Refresh user data
            await loadUserData(currentUser.id, true);
            
            // Refresh orders
            await loadP2POrders();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Buy order error:', error);
        showNotification('Ошибка при покупке', 'error');
    } finally {
        showLoading(false);
    }
}

// Cancel own order
async function cancelOrder(orderId) {
    if (!confirm('Отменить ордер?')) return;
    
    try {
        const response = await fetch(`/api/p2p/cancel/${orderId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id
            })
        });
        
        if (response.ok) {
            showNotification('Ордер отменен', 'success');
            
            // Refresh user data
            await loadUserData(currentUser.id, true);
            
            // Refresh orders
            await loadP2POrders();
        } else {
            const data = await response.json();
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Cancel order error:', error);
        showNotification('Ошибка при отмене', 'error');
    }
}

// Initialize P2P page
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('p2p')) {
        loadP2POrders();
        
        // Refresh every 30 seconds
        setInterval(loadP2POrders, 30000);
        
        // Add event listener for create button
        document.getElementById('create-order-btn')?.addEventListener('click', createOrder);
    }
});

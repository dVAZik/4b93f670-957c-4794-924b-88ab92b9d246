// ==================== ЧАТ ИГРОКОВ ====================

let chatMessages = [];
let lastMessageId = 0;
let chatRefreshInterval = null;

// Load chat messages
async function loadChat() {
    try {
        const response = await fetch('/api/chat/messages?limit=50');
        const data = await response.json();
        
        chatMessages = data;
        if (data.length > 0) {
            lastMessageId = Math.max(...data.map(m => m.id));
        }
        
        renderChat();
    } catch (error) {
        console.error('Failed to load chat:', error);
    }
}

// Render chat messages
function renderChat() {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    let html = '';
    chatMessages.forEach(msg => {
        const isSystem = msg.is_system;
        const isOwn = msg.username === currentUser?.username;
        
        html += `
            <div class="chat-message ${isSystem ? 'system' : ''} ${isOwn ? 'own' : ''}">
                <div class="message-header">
                    <span class="message-user">${isSystem ? '🔐 СИСТЕМА' : '👤 ' + msg.username}</span>
                    <span class="message-time">${msg.created_at}</span>
                </div>
                <div class="message-text ${msg.is_bonus ? 'bonus' : ''}">
                    ${escapeHtml(msg.message)}
                    ${msg.is_bonus ? `<span class="bonus-code" onclick="claimBonus('${msg.bonus_code}')">🔓 ЗАБРАТЬ</span>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// Send message
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (message.length > 200) {
        showNotification('Сообщение слишком длинное (макс. 200 символов)', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/chat/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                message: message
            })
        });
        
        if (response.ok) {
            input.value = '';
            await loadChat(); // Refresh chat
        } else {
            const data = await response.json();
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Send message error:', error);
        showNotification('Ошибка при отправке', 'error');
    }
}

// Claim bonus code
async function claimBonus(code) {
    try {
        const response = await fetch('/api/claim_bonus', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                code: code
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification(`+${data.bonus} $CODE получено!`, 'success');
            
            // Update balance
            currentUser.code_balance = data.new_balance;
            updateUI();
            
            // Remove bonus button
            event.target.remove();
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Claim bonus error:', error);
        showNotification('Ошибка при активации', 'error');
    }
}

// Escape HTML for safety
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Initialize chat page
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('chat')) {
        loadChat();
        
        // Refresh every 5 seconds
        chatRefreshInterval = setInterval(loadChat, 5000);
        
        // Send on Enter
        document.getElementById('chat-input')?.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
        
        // Send button
        document.getElementById('send-btn')?.addEventListener('click', sendMessage);
    }
});

// Cleanup on page leave
window.addEventListener('beforeunload', function() {
    if (chatRefreshInterval) {
        clearInterval(chatRefreshInterval);
    }
});

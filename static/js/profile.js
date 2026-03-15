// ==================== ПРОФИЛЬ ====================

// Load profile data
function loadProfile() {
    if (!currentUser) return;
    
    document.getElementById('profile-level').textContent = currentUser.level;
    document.getElementById('profile-clicks').textContent = formatNumber(currentUser.total_clicks);
    document.getElementById('profile-earned').textContent = formatNumber(currentUser.total_earned);
    document.getElementById('profile-warnings').textContent = currentUser.warnings;
    
    // Format join date
    if (currentUser.created_at) {
        const date = new Date(currentUser.created_at);
        document.getElementById('profile-joined').textContent = date.toLocaleDateString('ru-RU');
    }
    
    // Load masks
    loadMasks();
    
    // Generate referral link
    const referralLink = `https://t.me/your_bot?start=ref_${currentUser.id}`;
    document.getElementById('referral-link').value = referralLink;
}

// Load available masks
function loadMasks() {
    const maskGrid = document.getElementById('mask-grid');
    if (!maskGrid) return;
    
    let html = '';
    for (let i = 1; i <= 10; i++) {
        const isUnlocked = i <= 3 || i === currentUser.mask_id; // Simple unlock logic
        
        html += `
            <div class="mask-item ${isUnlocked ? 'unlocked' : 'locked'} ${i === currentUser.mask_id ? 'selected' : ''}" 
                 onclick="${isUnlocked ? `selectMask(${i})` : ''}">
                <img src="/static/images/masks/mask${i}.png" alt="Mask ${i}">
                ${!isUnlocked ? '<span class="lock-icon">🔒</span>' : ''}
            </div>
        `;
    }
    
    maskGrid.innerHTML = html;
    document.getElementById('mask-image').src = `/static/images/masks/mask${currentUser.mask_id}.png`;
}

// Select mask
async function selectMask(maskId) {
    if (maskId === currentUser.mask_id) return;
    
    try {
        const response = await fetch('/api/profile/select_mask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                mask_id: maskId
            })
        });
        
        if (response.ok) {
            currentUser.mask_id = maskId;
            document.getElementById('mask').textContent = `🎭 #${maskId}`;
            document.getElementById('mask-image').src = `/static/images/masks/mask${maskId}.png`;
            loadMasks(); // Refresh grid
            showNotification('Маска изменена', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Select mask error:', error);
        showNotification('Ошибка при выборе маски', 'error');
    }
}

// Change username
async function changeUsername() {
    const newUsername = prompt('Введите новый ник (только латиница, цифры и _ - [ ] { }):', currentUser.username);
    
    if (!newUsername || newUsername === currentUser.username) return;
    
    // Validate username
    const usernameRegex = /^[a-zA-Z0-9_\-\[\]\{\}]+$/;
    if (!usernameRegex.test(newUsername)) {
        showNotification('Недопустимые символы в нике', 'error');
        return;
    }
    
    if (newUsername.length < 3 || newUsername.length > 20) {
        showNotification('Ник должен быть от 3 до 20 символов', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/profile/change_username', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Auth': 'true'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                new_username: newUsername
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.username = newUsername;
            document.getElementById('username').textContent = newUsername;
            showNotification('Ник изменен', 'success');
        } else {
            showNotification(data.error, 'error');
        }
    } catch (error) {
        console.error('Change username error:', error);
        showNotification('Ошибка при смене ника', 'error');
    }
}

// Copy referral link
function copyReferralLink() {
    const link = document.getElementById('referral-link');
    link.select();
    document.execCommand('copy');
    showNotification('Ссылка скопирована!', 'success');
}

// Logout
function logout() {
    if (confirm('Выйти из аккаунта?')) {
        // Clear local data
        currentUser = null;
        
        // Close WebApp
        if (telegram) {
            telegram.close();
        } else {
            window.location.href = '/';
        }
    }
}

// Add CSS for profile
const profileStyle = document.createElement('style');
profileStyle.textContent = `
    .profile-container {
        padding: 16px;
    }
    
    .profile-avatar {
        text-align: center;
        margin-bottom: 30px;
    }
    
    .mask-display {
        width: 150px;
        height: 150px;
        margin: 0 auto 20px;
        border: 3px solid #00ff9d;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 0 30px rgba(0, 255, 157, 0.3);
    }
    
    .mask-display img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .mask-selector h3 {
        color: #00ff9d;
        margin-bottom: 15px;
    }
    
    .mask-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
        margin-bottom: 20px;
    }
    
    .mask-item {
        position: relative;
        aspect-ratio: 1;
        border: 2px solid #2d333b;
        border-radius: 8px;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .mask-item:hover:not(.locked) {
        border-color: #00ff9d;
        transform: scale(1.1);
    }
    
    .mask-item.selected {
        border-color: #00ff9d;
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.3);
    }
    
    .mask-item.locked {
        opacity: 0.5;
        filter: grayscale(1);
        cursor: not-allowed;
    }
    
    .mask-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .lock-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 24px;
    }
    
    .profile-stats {
        background: #1e2329;
        border: 1px solid #2d333b;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 20px;
    }
    
    .profile-stats h3 {
        color: #00ff9d;
        margin-bottom: 15px;
    }
    
    .stat-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #2d333b;
    }
    
    .stat-row:last-child {
        border-bottom: none;
    }
    
    .stat-name {
        color: #8b949e;
    }
    
    .stat-value {
        color: #e0e0e0;
        font-weight: bold;
    }
    
    .profile-referral {
        background: #1e2329;
        border: 1px solid #2d333b;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 20px;
    }
    
    .profile-referral h3 {
        color: #00ff9d;
        margin-bottom: 10px;
    }
    
    .profile-referral p {
        color: #8b949e;
        font-size: 12px;
        margin-bottom: 15px;
    }
    
    .referral-link-container {
        display: flex;
        gap: 10px;
    }
    
    .referral-link-container input {
        flex: 1;
        padding: 10px;
        background: #0a0c0f;
        border: 1px solid #2d333b;
        border-radius: 6px;
        color: #00ff9d;
        font-family: monospace;
        font-size: 12px;
    }
    
    .referral-link-container button {
        padding: 10px 15px;
        background: #00ff9d;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
    }
    
    .profile-actions {
        display: flex;
        gap: 10px;
    }
    
    .action-btn {
        flex: 1;
        padding: 12px;
        background: #2d333b;
        border: none;
        border-radius: 6px;
        color: #e0e0e0;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .action-btn:hover {
        background: #3d444d;
    }
    
    .action-btn.danger:hover {
        background: #ff4d4d;
    }
`;
document.head.appendChild(profileStyle);

// Initialize profile
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('profile')) {
        // Wait for user data
        const checkUser = setInterval(() => {
            if (currentUser) {
                loadProfile();
                clearInterval(checkUser);
            }
        }, 100);
    }
});

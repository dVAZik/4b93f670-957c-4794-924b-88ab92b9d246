// Глобальные переменные
let tg = window.Telegram.WebApp;
let userId = tg.initDataUnsafe?.user?.id || 123456789; // Для теста
let currentBalance = 0;

// Инициализация Telegram WebApp
tg.ready();
tg.expand();

// Список игр
const games = [
    { id: 'plinko', title: 'ПЛИНКО', emoji: '📌', color: '#ff6b6b' },
    { id: 'slots', title: 'СЛОТЫ', emoji: '🎰', color: '#4ecdc4' },
    { id: 'coinflip', title: 'ОРЕЛ/РЕШКА', emoji: '🪙', color: '#ffe66d' },
    { id: 'dice', title: 'КОСТИ', emoji: '🎲', color: '#ff9ff3' },
    { id: 'crash', title: 'КРЭШ', emoji: '📈', color: '#feca57' },
    { id: 'keno', title: 'КЕНО', emoji: '🎱', color: '#ff6b6b' },
    { id: 'blackjack', title: 'БЛЭКДЖЕК', emoji: '🃏', color: '#48dbfb' },
    { id: 'roulette', title: 'РУЛЕТКА', emoji: '🎯', color: '#1dd1a1' },
    { id: 'miner', title: 'МАЙНЕР', emoji: '⛏️', color: '#f368e0' },
    { id: 'wheel', title: 'КОЛЕСО', emoji: '🎡', color: '#ff9f43' }
];

// Загрузка данных пользователя
async function loadUserData() {
    try {
        const response = await fetch(`/api/user/${userId}`);
        const user = await response.json();
        currentBalance = user.balance;
        updateBalance();
    } catch (error) {
        console.error('Error loading user:', error);
        currentBalance = 1000;
        updateBalance();
    }
}

// Обновление баланса на странице
function updateBalance() {
    document.getElementById('balance').textContent = currentBalance;
}

// Обновление баланса через API
async function updateBalanceAPI(amount, game, bet) {
    try {
        const response = await fetch('/api/update_balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, amount, game, bet })
        });
        const data = await response.json();
        currentBalance = data.balance;
        updateBalance();
        return data.balance;
    } catch (error) {
        console.error('Error updating balance:', error);
        return currentBalance;
    }
}

// Ежедневный бонус
async function claimDailyBonus() {
    const btn = document.getElementById('dailyBonus');
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/daily_bonus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        const data = await response.json();
        
        if (data.success) {
            currentBalance = data.balance;
            updateBalance();
            tg.showAlert('🎉 Получено +200 монет!');
            btn.textContent = '✓ ПОЛУЧЕНО';
        } else {
            tg.showAlert('⏰ Бонус уже получен сегодня!');
            btn.disabled = false;
        }
    } catch (error) {
        console.error('Error claiming bonus:', error);
        btn.disabled = false;
    }
}

// Создание сетки игр
function createGamesGrid() {
    const grid = document.getElementById('gamesGrid');
    grid.innerHTML = '';
    
    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.style.borderColor = game.color;
        card.innerHTML = `
            <div class="game-emoji">${game.emoji}</div>
            <div class="game-title">${game.title}</div>
        `;
        card.onclick = () => openGame(game.id);
        grid.appendChild(card);
    });
}

// Открытие игры
function openGame(gameId) {
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            <iframe class="game-frame" src="/games/${gameId}.html" frameborder="0"></iframe>
        </div>
    `;
    
    // Закрытие по клику на крестик
    modal.querySelector('.close-btn').onclick = () => modal.remove();
    
    // Закрытие по клику вне модалки
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    createGamesGrid();
    await loadUserData();
    
    // Обработчик кнопки бонуса
    document.getElementById('dailyBonus').onclick = claimDailyBonus;
    
    // Сохраняем функции в глобальную область для доступа из игр
    window.TelegramCasino = {
        userId: userId,
        getBalance: () => currentBalance,
        updateBalance: updateBalanceAPI,
        showAlert: (msg) => tg.showAlert(msg)
    };
});

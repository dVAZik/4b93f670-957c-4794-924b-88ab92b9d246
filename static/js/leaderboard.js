// ==================== ТАБЛИЦА ЛИДЕРОВ ====================

let leaderboardData = [];

// Load leaderboard
async function loadLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const data = await response.json();
        
        leaderboardData = data;
        renderLeaderboard();
    } catch (error) {
        console.error('Failed to load leaderboard:', error);
    }
}

// Render leaderboard
function renderLeaderboard() {
    const container = document.getElementById('leaderboard-container');
    if (!container) return;
    
    let html = '<div class="leaderboard">';
    
    leaderboardData.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        
        html += `
            <div class="leaderboard-row ${medalClass} ${player.username === currentUser?.username ? 'current-user' : ''}">
                <div class="rank">${medal} #${player.rank}</div>
                <div class="player-info">
                    <span class="player-name">${player.username}</span>
                    <span class="player-mask">🎭 #${player.mask_id}</span>
                </div>
                <div class="player-stats">
                    <div class="stat-hack">💎 ${formatNumber(player.hack_balance)}</div>
                    <div class="stat-level">📊 ${player.level}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// Add CSS for leaderboard
const leaderboardStyle = document.createElement('style');
leaderboardStyle.textContent = `
    .leaderboard {
        padding: 16px;
    }
    
    .leaderboard-row {
        background: #1e2329;
        border: 1px solid #2d333b;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all 0.3s ease;
    }
    
    .leaderboard-row:hover {
        border-color: #00ff9d;
        transform: translateX(5px);
    }
    
    .leaderboard-row.gold {
        background: linear-gradient(45deg, #1e2329, #3a2e1e);
        border-color: #ffd700;
    }
    
    .leaderboard-row.silver {
        background: linear-gradient(45deg, #1e2329, #2f3238);
        border-color: #c0c0c0;
    }
    
    .leaderboard-row.bronze {
        background: linear-gradient(45deg, #1e2329, #342a1f);
        border-color: #cd7f32;
    }
    
    .leaderboard-row.current-user {
        border-color: #00ff9d;
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.2);
    }
    
    .rank {
        font-size: 16px;
        font-weight: bold;
        min-width: 80px;
    }
    
    .player-info {
        flex: 1;
        display: flex;
        flex-direction: column;
    }
    
    .player-name {
        font-size: 16px;
        font-weight: bold;
        color: #00ff9d;
    }
    
    .player-mask {
        font-size: 12px;
        color: #8b949e;
    }
    
    .player-stats {
        text-align: right;
    }
    
    .stat-hack {
        color: #3b82f6;
        font-weight: bold;
        font-size: 16px;
    }
    
    .stat-level {
        font-size: 12px;
        color: #8b949e;
    }
`;
document.head.appendChild(leaderboardStyle);

// Initialize leaderboard
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('leaderboard')) {
        loadLeaderboard();
        
        // Refresh every minute
        setInterval(loadLeaderboard, 60000);
    }
});

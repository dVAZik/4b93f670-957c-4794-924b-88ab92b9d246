// ==================== ANTI-CHEAT CLIENT ====================
// This script runs on the client side to detect and prevent cheating

class AntiCheatClient {
    constructor() {
        this.clickTimestamps = [];
        this.lastClickTime = 0;
        this.clickCount = 0;
        this.sessionStart = Date.now();
        this.suspiciousActivities = [];
        this.energyChecks = [];
        this.verifyInterval = null;
        this.userHash = '';
        
        // Bind methods
        this.recordClick = this.recordClick.bind(this);
        this.checkForCheats = this.checkForCheats.bind(this);
        this.generateClientHash = this.generateClientHash.bind(this);
        
        // Start monitoring
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Check for devtools
        this.detectDevTools();
        
        // Regular verification
        this.verifyInterval = setInterval(() => {
            this.checkForCheats();
        }, 5000);
        
        // Monitor for speed hacks
        this.monitorSpeedHacks();
    }
    
    recordClick() {
        const now = Date.now();
        
        // Add timestamp
        this.clickTimestamps.push(now);
        
        // Keep only last 60 seconds
        const cutoff = now - 60000;
        this.clickTimestamps = this.clickTimestamps.filter(t => t > cutoff);
        
        // Calculate CPS
        const lastSecond = this.clickTimestamps.filter(t => now - t <= 1000);
        const cps = lastSecond.length;
        
        // Check for auto-clicker (too fast)
        if (cps > 20) {
            this.reportViolation('speed_hack', `CPS: ${cps}`);
            return false;
        }
        
        // Check for pattern (too regular)
        if (this.clickTimestamps.length >= 10) {
            const pattern = this.analyzePattern();
            if (pattern > 0.8) {
                this.reportViolation('auto_clicker', `Pattern score: ${pattern}`);
                return false;
            }
        }
        
        // Check time since last click (too fast)
        if (this.lastClickTime > 0) {
            const timeDiff = now - this.lastClickTime;
            if (timeDiff < 10) { // Less than 10ms
                this.reportViolation('rapid_fire', `Interval: ${timeDiff}ms`);
                return false;
            }
        }
        
        this.lastClickTime = now;
        this.clickCount++;
        
        return true;
    }
    
    analyzePattern() {
        if (this.clickTimestamps.length < 5) return 0;
        
        // Get last 10 timestamps
        const recent = this.clickTimestamps.slice(-10);
        
        // Calculate intervals
        const intervals = [];
        for (let i = 1; i < recent.length; i++) {
            intervals.push(recent[i] - recent[i-1]);
        }
        
        if (intervals.length === 0) return 0;
        
        // Calculate variance
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Low variance indicates automation
        const patternScore = 1 - Math.min(1, stdDev / 50); // Normalize
        
        // Check for perfect repetition
        const uniqueIntervals = new Set(intervals.map(i => Math.round(i)));
        const repetitionScore = 1 - (uniqueIntervals.size / intervals.length);
        
        return (patternScore * 0.7) + (repetitionScore * 0.3);
    }
    
    detectDevTools() {
        // Detect if devtools is open
        const devtools = {
            isOpen: false,
            orientation: null
        };
        
        // Method 1: Check console.log
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: function() {
                devtools.isOpen = true;
                devtools.orientation = 'console';
                return '';
            }
        });
        
        console.log(element);
        
        // Method 2: Check window size
        const threshold = 160;
        const checkDevTools = () => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            
            if (widthThreshold || heightThreshold) {
                if (!devtools.isOpen) {
                    devtools.isOpen = true;
                    devtools.orientation = 'window';
                    this.reportViolation('devtools', 'Developer tools detected');
                }
            }
        };
        
        setInterval(checkDevTools, 1000);
    }
    
    monitorSpeedHacks() {
        let lastTime = Date.now();
        let timeCheats = 0;
        
        setInterval(() => {
            const now = Date.now();
            const expectedDiff = 1000; // 1 second
            
            // Check if time is flowing too fast
            if (now - lastTime > expectedDiff * 1.5) {
                timeCheats++;
                if (timeCheats > 3) {
                    this.reportViolation('time_acceleration', `Time jump detected`);
                }
            }
            
            lastTime = now;
        }, 1000);
    }
    
    generateClientHash(userData) {
        // Create a hash of client state
        const data = {
            ...userData,
            timestamp: Date.now(),
            screenSize: `${window.screen.width}x${window.screen.height}`,
            userAgent: this.getNormalizedUserAgent(),
            clickPattern: this.clickTimestamps.slice(-10)
        };
        
        // Simple hash function
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        this.userHash = hash.toString(16);
        return this.userHash;
    }
    
    getNormalizedUserAgent() {
        const ua = navigator.userAgent;
        // Return a simplified version to detect emulators
        if (ua.includes('Headless')) return 'headless';
        if (ua.includes('PhantomJS')) return 'phantom';
        return 'normal';
    }
    
    reportViolation(type, details) {
        // Log to console
        console.warn(`Anti-cheat: ${type} - ${details}`);
        
        // Store for reporting
        this.suspiciousActivities.push({
            type,
            details,
            timestamp: Date.now()
        });
        
        // Send to server
        this.sendViolationToServer(type, details);
        
        // Show warning
        this.showCheatWarning(type);
    }
    
    sendViolationToServer(type, details) {
        // Debounce to avoid spam
        if (this.lastReport && Date.now() - this.lastReport < 10000) {
            return;
        }
        
        this.lastReport = Date.now();
        
        fetch('/api/anticheat/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: type,
                details: details,
                clientData: {
                    url: window.location.href,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent
                }
            })
        }).catch(err => console.error('Failed to report violation:', err));
    }
    
    showCheatWarning(type) {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        let message = '';
        switch(type) {
            case 'speed_hack':
                message = '⚠️ Обнаружен авто-кликер! Предупреждение 1/3';
                break;
            case 'auto_clicker':
                message = '⚠️ Подозрительный паттерн кликов!';
                break;
            case 'devtools':
                message = '⚠️ Режим разработчика обнаружен!';
                break;
            case 'time_acceleration':
                message = '⚠️ Обнаружено ускорение времени!';
                break;
            default:
                message = '⚠️ Подозрительная активность!';
        }
        
        notification.textContent = message;
        notification.style.display = 'block';
        notification.style.background = '#ff4d4d';
        notification.style.color = 'white';
        
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
    
    checkForCheats() {
        // Check session length
        const sessionLength = (Date.now() - this.sessionStart) / 1000 / 60; // minutes
        if (sessionLength > 60) {
            // Session too long, might be bot
            this.reportViolation('session_length', `${Math.round(sessionLength)} minutes`);
        }
        
        // Check click count
        if (this.clickCount > 5000 && sessionLength < 10) {
            // Too many clicks in short time
            this.reportViolation('excessive_clicks', `${this.clickCount} clicks in ${Math.round(sessionLength)} minutes`);
        }
    }
    
    cleanup() {
        if (this.verifyInterval) {
            clearInterval(this.verifyInterval);
        }
    }
}

// Initialize anti-cheat
const anticheat = new AntiCheatClient();

// ==================== АНИМАЦИИ ====================

class AnimationManager {
    constructor() {
        this.matrixInterval = null;
        this.candlesInterval = null;
        this.canvas = document.getElementById('matrix-bg');
        this.ctx = this.canvas?.getContext('2d');
        this.init();
    }

    init() {
        if (this.canvas) {
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            this.startMatrixAnimation();
        }
        
        // Start candles animation if on exchange page
        if (window.location.pathname.includes('exchange')) {
            this.startCandlesAnimation();
        }
    }

    // ========== MATRIX BACKGROUND ==========
    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    startMatrixAnimation() {
        if (this.matrixInterval) clearInterval(this.matrixInterval);

        const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
        const fontSize = 14;
        const columns = this.canvas.width / fontSize;
        
        const drops = [];
        for (let i = 0; i < columns; i++) {
            drops[i] = Math.floor(Math.random() * this.canvas.height / fontSize);
        }

        this.matrixInterval = setInterval(() => {
            if (!this.ctx || !this.canvas) return;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#0F0';
            this.ctx.font = fontSize + 'px monospace';
            
            for (let i = 0; i < drops.length; i++) {
                const text = chars[Math.floor(Math.random() * chars.length)];
                this.ctx.fillText(text, i * fontSize, drops[i] * fontSize);
                
                if (drops[i] * fontSize > this.canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        }, 50);
    }

    // ========== CANDLES ANIMATION ==========
    startCandlesAnimation() {
        if (this.candlesInterval) clearInterval(this.candlesInterval);
        
        // Create canvas for candles if not exists
        let candlesCanvas = document.getElementById('candles-chart');
        if (!candlesCanvas) {
            candlesCanvas = document.createElement('canvas');
            candlesCanvas.id = 'candles-chart';
            candlesCanvas.style.position = 'fixed';
            candlesCanvas.style.top = '0';
            candlesCanvas.style.left = '0';
            candlesCanvas.style.width = '100%';
            candlesCanvas.style.height = '100%';
            candlesCanvas.style.zIndex = '-1';
            candlesCanvas.style.opacity = '0.1';
            document.body.appendChild(candlesCanvas);
        }
        
        const ctx = candlesCanvas.getContext('2d');
        let width = window.innerWidth;
        let height = window.innerHeight;
        
        candlesCanvas.width = width;
        candlesCanvas.height = height;
        
        let prices = [];
        for (let i = 0; i < 50; i++) {
            prices.push({
                open: 100 + Math.random() * 20,
                high: 0,
                low: 0,
                close: 0
            });
        }
        
        // Update prices randomly
        this.candlesInterval = setInterval(() => {
            if (!ctx || !candlesCanvas) return;
            
            ctx.clearRect(0, 0, width, height);
            
            // Generate new candle
            const lastPrice = prices[prices.length - 1]?.close || 100;
            const change = (Math.random() - 0.5) * 10;
            const newClose = Math.max(50, lastPrice + change);
            const newOpen = lastPrice;
            const newHigh = Math.max(newOpen, newClose) + Math.random() * 5;
            const newLow = Math.min(newOpen, newClose) - Math.random() * 5;
            
            prices.push({
                open: newOpen,
                high: newHigh,
                low: newLow,
                close: newClose
            });
            
            if (prices.length > 50) prices.shift();
            
            // Draw candles
            const candleWidth = (width - 100) / 50;
            const maxPrice = Math.max(...prices.map(p => p.high));
            const minPrice = Math.min(...prices.map(p => p.low));
            const priceRange = maxPrice - minPrice || 1;
            
            ctx.strokeStyle = '#00ff9d';
            ctx.lineWidth = 1;
            
            prices.forEach((candle, i) => {
                const x = 50 + i * candleWidth;
                
                const openY = height - 50 - ((candle.open - minPrice) / priceRange) * (height - 100);
                const closeY = height - 50 - ((candle.close - minPrice) / priceRange) * (height - 100);
                const highY = height - 50 - ((candle.high - minPrice) / priceRange) * (height - 100);
                const lowY = height - 50 - ((candle.low - minPrice) / priceRange) * (height - 100);
                
                // Wick
                ctx.beginPath();
                ctx.moveTo(x + candleWidth / 2, highY);
                ctx.lineTo(x + candleWidth / 2, lowY);
                ctx.strokeStyle = candle.close > candle.open ? '#00ff9d' : '#ff4d4d';
                ctx.stroke();
                
                // Body
                ctx.fillStyle = candle.close > candle.open ? 'rgba(0, 255, 157, 0.3)' : 'rgba(255, 77, 77, 0.3)';
                ctx.fillRect(x, Math.min(openY, closeY), candleWidth - 2, Math.abs(closeY - openY));
            });
            
        }, 2000);
    }

    // ========== GLITCH EFFECT ==========
    glitchEffect(element, intensity = 1) {
        if (!element) return;
        
        const originalText = element.textContent;
        const glitchChars = "!@#$%&*+=-_?/\\|<>[]{}";
        
        let glitchInterval = setInterval(() => {
            if (Math.random() > 0.7) {
                let glitchedText = "";
                for (let i = 0; i < originalText.length; i++) {
                    if (Math.random() < 0.3 * intensity) {
                        glitchedText += glitchChars[Math.floor(Math.random() * glitchChars.length)];
                    } else {
                        glitchedText += originalText[i];
                    }
                }
                element.textContent = glitchedText;
            } else {
                element.textContent = originalText;
            }
        }, 100);
        
        // Stop after 2 seconds
        setTimeout(() => {
            clearInterval(glitchInterval);
            element.textContent = originalText;
        }, 2000);
    }

    // ========== TERMINAL TYPING ==========
    typeText(element, text, speed = 50) {
        if (!element) return;
        
        let i = 0;
        element.textContent = '';
        
        const typing = setInterval(() => {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
            } else {
                clearInterval(typing);
            }
        }, speed);
    }

    // ========== SCANLINE EFFECT ==========
    addScanlines() {
        const scanlines = document.createElement('div');
        scanlines.className = 'scanlines';
        scanlines.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                to bottom,
                transparent 50%,
                rgba(0, 255, 157, 0.03) 50%
            );
            background-size: 100% 4px;
            pointer-events: none;
            z-index: 9999;
            opacity: 0.3;
        `;
        document.body.appendChild(scanlines);
    }

    // ========== CRT EFFECT ==========
    addCRTEffect() {
        const crt = document.createElement('div');
        crt.className = 'crt-effect';
        crt.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(
                ellipse at center,
                transparent 0%,
                rgba(0, 0, 0, 0.2) 100%
            );
            pointer-events: none;
            z-index: 9998;
            animation: flicker 0.15s infinite;
        `;
        document.body.appendChild(crt);
        
        // Add flicker animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes flicker {
                0% { opacity: 0.2; }
                50% { opacity: 0.25; }
                100% { opacity: 0.2; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize animations
const animations = new AnimationManager();

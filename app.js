class BetSmartApp {
    constructor() {
        this.bets = [];
        this.gameData = {};
        this.selectedSport = 'All Sports';
        this.sortBy = 'value';
        this.highValueOnly = false;
        this.DATA_URL = this.resolveDataUrl();
        
        // Firebase configuration
        this.firebaseConfig = {
            apiKey: "AIzaSyCzXxF1HkUYB6EJq5jAVz8X3pM4NkPg8iA",
            authDomain: "aurabetz.firebaseapp.com",
            projectId: "aurabetz",
            storageBucket: "aurabetz.firebasestorage.app",
            messagingSenderId: "531651661385",
            appId: "1:531651661385:web:d82a50a33bb77297b7f998",
            measurementId: "G-7L19JWBH21"
        };
        
        try {
            // Initialize Firebase only if not already initialized
            if (!firebase.apps.length) {
                this.app = firebase.initializeApp(this.firebaseConfig);
            } else {
                this.app = firebase.app();
            }
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            // Check for existing auth
            const savedPin = localStorage.getItem('betSmartAuth');
            if (savedPin) {
                this.verifyPin(savedPin);
            } else {
                this.initAuth();
            }
        } catch (error) {
            console.error("Firebase initialization error:", error);
            this.handleAuthError(error);
        }
    }

    resolveDataUrl() {
        return window.location.host.includes('github.io') 
            ? '/aurabetz-public-1.0/data/bets.json' 
            : 'data/bets.json';
    }

    initAuth() {
        const authWall = document.getElementById('authWall');
        if (!authWall) {
            this.handleAuthError(new Error("Auth wall element not found"));
            return;
        }
        
        authWall.style.display = 'flex';
        
        document.getElementById('submitPin').onclick = () => {
            const pin = document.getElementById('pinInput').value.trim();
            if (!pin) {
                this.showPinError("Please enter a PIN");
                return;
            }
            this.verifyPin(pin);
        };
        
        document.getElementById('pinInput').onkeypress = (e) => {
            if (e.key === 'Enter') {
                document.getElementById('submitPin').click();
            }
        };
    }

    verifyPin(pin) {
    this.db.collection("validPins").doc("gfmQtH31uKikW1LnV601").get()
        .then((doc) => {
            if (!doc.exists || doc.data().pin !== pin) {
                throw new Error("Invalid PIN");
            }
            localStorage.setItem('betSmartAuth', pin);
            return this.auth.signInAnonymously();
        })
        .then(() => {
            document.getElementById('authWall').style.display = 'none';
            this.initApp();
        })
        .catch((error) => {
            console.error("PIN verification failed:", error);
            this.showPinError("Invalid PIN");
            localStorage.removeItem('betSmartAuth');
        });
}

    showPinError(message) {
        const errorElement = document.getElementById('pinError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    initApp() {
        document.getElementById('appContent').style.display = 'none';
        document.getElementById('loadingSpinner').style.display = 'flex';
        
        this.loadData()
            .then(() => {
                this.render();
                this.setupEventListeners();
                this.checkDarkMode();
                document.getElementById('appContent').style.display = 'block';
                document.getElementById('loadingSpinner').style.display = 'none';
            })
            .catch((error) => {
                console.error("App initialization failed:", error);
                this.handleAuthError(error);
            });
    }

    handleAuthError(error) {
        console.error("Auth error:", error);
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.innerHTML = `
                <div class="spinner-content">
                    <i class="fas fa-exclamation-triangle" style="color: red; font-size: 2rem;"></i>
                    <p style="color: red; margin-top: 20px;">
                        Error loading BetSmart. Please refresh or check your connection.
                    </p>
                    <button onclick="window.location.reload()" 
                            style="margin-top: 10px; padding: 8px 16px; 
                                   background: var(--primary); color: white; 
                                   border: none; border-radius: 4px; cursor: pointer;">
                        Refresh Page
                    </button>
                </div>`;
        }
    }

    getDefaultBets() {
        return [
            {
                id: 1,
                sport: "UFC",
                event: "Jon Jones vs Stipe Miocic",
                time: "2023-11-12T03:00:00Z",
                mainBet: {
                    type: "Moneyline",
                    pick: "Jon Jones",
                    odds: -180,
                    probability: 0.75,
                    value: 0.25,
                    confidence: "High"
                },
                otherBets: [],
                analysis: "Default analysis...",
                aiReasoning: "Default AI reasoning...",
                sportsbooks: [
                    { name: "DraftKings", odds: -180 },
                    { name: "FanDuel", odds: -175 },
                    { name: "BetMGM", odds: -185 }
                ]
            }
        ];
    }

    getDefaultGameData() {
        return {
            currentDay: 1,
            completedDays: 0,
            startingAmount: 10,
            currentAmount: 10,
            bets: [
                {
                    day: 1,
                    sport: "UFC",
                    event: "Jon Jones vs Stipe Miocic",
                    bet: "Jon Jones",
                    betType: "Moneyline",
                    odds: -180,
                    amount: 10,
                    potentialProfit: 15,
                    completed: false,
                    won: null
                }
            ]
        };
    }

    async loadData() {
        try {
            const response = await fetch(this.DATA_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            
            this.bets = (data.bets || this.getDefaultBets()).filter(bet => 
                bet.event && 
                bet.event.trim() !== "" && 
                !bet.event.toLowerCase().includes("bitch") &&
                bet.mainBet && 
                bet.mainBet.pick
            );
            
            this.gameData = data.gameData || this.getDefaultGameData();
            
            const currentDayBet = this.gameData.bets.find(b => b.day === this.gameData.currentDay);
            if (!currentDayBet) {
                this.resetGame();
            }
        } catch (error) {
            console.error("Data load failed, using defaults:", error);
            this.bets = this.getDefaultBets();
            this.gameData = this.getDefaultGameData();
            alert("Warning: Using demo data. Some features may be limited.");
        }
        this.render();
    }

    render() {
        this.renderBets(this.filterAndSortBets());
    }

    setupEventListeners() {
        // Remove all existing listeners first
        this.removeAllEventListeners();

        // Add new listeners
        this.safeAddEventListener('#darkModeToggle', 'click', () => this.toggleDarkMode());
        this.safeAddEventListener('#subscribeBtn', 'click', () => this.showSubscribeModal());

        document.querySelectorAll('.tab').forEach(tab => {
            this.safeAddEventListener(tab, 'click', (e) => {
                this.selectedSport = e.currentTarget.getAttribute('data-sport');
                this.updateActiveSportTab();
                this.renderBets(this.filterAndSortBets());
            });
        });

        this.safeAddEventListener('#sortOptions', 'change', (e) => {
            this.sortBy = e.target.value;
            this.renderBets(this.filterAndSortBets());
        });

        this.safeAddEventListener('#highValueOnly', 'change', (e) => {
            this.highValueOnly = e.target.checked;
            this.renderBets(this.filterAndSortBets());
        });

        // Modal controls
        this.safeAddEventListener('#closeModal', 'click', () => this.hideDetailModal());
        this.safeAddEventListener('#detailModal', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideDetailModal();
        });

        // Game modal controls
        this.safeAddEventListener('#theGameBtn', 'click', () => {
            this.showGameModal();
            this.updateGameProgress();
        });
        this.safeAddEventListener('#closeGameModal', 'click', () => this.hideGameModal());
        this.safeAddEventListener('#gameModal', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideGameModal();
        });

        // Subscribe modal controls
        this.safeAddEventListener('#closeSubscribeModal', 'click', () => this.hideSubscribeModal());
        this.safeAddEventListener('#subscribeModal', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideSubscribeModal();
        });

        // Delegated events
        this.safeAddEventListener(document, 'click', (e) => {
            if (e.target.classList.contains('view-analysis-btn')) {
                const card = e.target.closest('.bet-card');
                if (card) {
                    const betId = parseInt(card.getAttribute('data-bet-id'));
                    if (!isNaN(betId)) {
                        this.showDetailModal(betId);
                        e.stopPropagation();
                    }
                }
            }

            if (e.target.classList.contains('payment-select-btn')) {
                const paymentOption = e.target.closest('.payment-option');
                if (paymentOption) {
                    const paymentMethod = paymentOption.querySelector('h3')?.textContent;
                    if (paymentMethod) {
                        alert(`Selected ${paymentMethod}. Payment processing would be implemented here.`);
                        this.hideSubscribeModal();
                    }
                }
            }
        });

        // Diamond progress
        document.querySelectorAll('.diamond').forEach(diamond => {
            this.safeAddEventListener(diamond, 'click', (e) => {
                const day = parseInt(e.currentTarget.getAttribute('data-day'));
                if (!isNaN(day) && day === this.gameData.currentDay) {
                    this.completeCurrentDay(true);
                }
            });
        });
    }

    safeAddEventListener(selectorOrElement, event, handler) {
        const element = typeof selectorOrElement === 'string' 
            ? document.querySelector(selectorOrElement) 
            : selectorOrElement;
        
        if (!element) return;
        element.removeEventListener(event, handler);
        element.addEventListener(event, handler);
    }

    removeAllEventListeners() {
        const elements = [
            '#darkModeToggle',
            '#subscribeBtn',
            '#sortOptions',
            '#highValueOnly',
            '#closeModal',
            '#detailModal',
            '#theGameBtn',
            '#closeGameModal',
            '#gameModal',
            '#closeSubscribeModal',
            '#subscribeModal',
            document,
            ...document.querySelectorAll('.tab'),
            ...document.querySelectorAll('.diamond')
        ];

        elements.forEach(element => {
            if (typeof element === 'string') {
                const el = document.querySelector(element);
                if (el) el.replaceWith(el.cloneNode(true));
            } else {
                element.replaceWith(element.cloneNode(true));
            }
        });
    }

    showSubscribeModal() {
        document.getElementById('subscribeModal')?.classList.add('active');
    }

    hideSubscribeModal() {
        document.getElementById('subscribeModal')?.classList.remove('active');
    }

    filterAndSortBets() {
        let filteredBets = [...this.bets];
        
        if (this.selectedSport !== 'All Sports') {
            filteredBets = filteredBets.filter(bet => bet.sport === this.selectedSport);
        }
        
        if (this.highValueOnly) {
            filteredBets = filteredBets.filter(bet => bet.mainBet.value >= 0.20);
        }
        
        switch(this.sortBy) {
            case 'value':
                filteredBets.sort((a, b) => (b.mainBet.value || 0) - (a.mainBet.value || 0));
                break;
            case 'odds':
                filteredBets.sort((a, b) => (a.mainBet.odds || 0) - (b.mainBet.odds || 0));
                break;
            case 'confidence':
                const confidenceMap = { 'High': 3, 'Medium': 2, 'Low': 1 };
                filteredBets.sort((a, b) => 
                    confidenceMap[b.mainBet.confidence || 'Medium'] - 
                    confidenceMap[a.mainBet.confidence || 'Medium']
                );
                break;
            case 'time':
                filteredBets.sort((a, b) => {
                    const dateA = a.time ? new Date(a.time) : new Date(0);
                    const dateB = b.time ? new Date(b.time) : new Date(0);
                    return dateA - dateB;
                });
                break;
        }
        
        return filteredBets;
    }

    renderBets(betsToRender) {
        const container = document.getElementById('betsContainer');
        if (!container) return;
        
        container.innerHTML = '';

        if (betsToRender.length === 0) {
            container.innerHTML = '<div class="no-results">No betting opportunities match your current filters.</div>';
            return;
        }

        betsToRender.forEach(bet => {
            const card = this.createBetCard(bet);
            if (card.childNodes.length > 0) {
                container.appendChild(card);
            }
        });

        document.querySelectorAll('.bet-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const betId = parseInt(card.getAttribute('data-bet-id'));
                this.showDetailModal(betId);
            });
        });
    }

    createBetCard(bet) {
        if (!bet.event || !bet.mainBet || !bet.mainBet.pick) {
            return document.createElement('div');
        }

        const valueClass = this.getValueClass(bet.mainBet.value || 0);
        const confidenceBadgeClass = this.getConfidenceBadgeClass(bet.mainBet.confidence || "Medium");
        
        const card = document.createElement('div');
        card.className = 'bet-card';
        card.setAttribute('data-bet-id', bet.id);
        
        card.innerHTML = `
            <div class="bet-card-content">
                <div class="bet-info-icon">
                    <i class="fas fa-info-circle text-primary"></i>
                </div>
                <div class="bet-header">
                    <span class="bet-sport">${bet.sport || 'Unknown Sport'}</span>
                    <span class="bet-time">${this.formatDate(bet.time)}</span>
                </div>
                <h3 class="bet-title">${bet.event}</h3>
                <div class="bet-main">
                    <div class="bet-type-row">
                        <span class="bet-type">${bet.mainBet.type || 'Unknown Type'}</span>
                        ${bet.mainBet.value ? `<span class="bet-value ${valueClass}">Value: ${(bet.mainBet.value * 100).toFixed(0)}%</span>` : ''}
                    </div>
                    <div class="bet-selection-row">
                        <div class="bet-pick-container">
                            <div class="bet-pick">${bet.mainBet.pick}</div>
                            ${bet.mainBet.odds ? `<div class="bet-odds ${valueClass}">${this.formatAmericanOdds(bet.mainBet.odds)}</div>` : ''}
                        </div>
                        <span class="confidence-badge ${confidenceBadgeClass}">${bet.mainBet.confidence || 'Medium'} Confidence</span>
                    </div>
                </div>
                <div class="bet-footer">
                    ${this.getBestOdds(bet.sportsbooks) ? `<span class="best-odds">Best Odds: ${this.getBestOdds(bet.sportsbooks)}</span>` : ''}
                    <button class="view-analysis-btn">View Analysis</button>
                </div>
            </div>
        `;
        
        return card;
    }

    getBestOdds(sportsbooks) {
        if (!sportsbooks || sportsbooks.length === 0) return null;
        const validOdds = sportsbooks.filter(sb => sb.odds !== null && sb.odds !== undefined);
        if (validOdds.length === 0) return null;
        const bestOdds = Math.max(...validOdds.map(sb => sb.odds));
        return this.formatAmericanOdds(bestOdds);
    }

    updateActiveSportTab() {
        const sportTabs = document.querySelectorAll('.tab');
        sportTabs.forEach(tab => {
            const sport = tab.getAttribute('data-sport');
            tab.classList.remove('tab-active');
            tab.classList.add('tab-inactive');
            
            if (sport === this.selectedSport) {
                tab.classList.remove('tab-inactive');
                tab.classList.add('tab-active');
            }
        });
    }

    showDetailModal(betId) {
        const bet = this.bets.find(b => b.id === betId);
        if (!bet) return;

        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        if (!modalTitle || !modalContent) return;
        
        modalTitle.textContent = bet.event;
        
        const sportsBookComparison = bet.sportsbooks 
            ? bet.sportsbooks.filter(sb => sb.odds !== null && sb.odds !== undefined)
                .map(sb => `
                    <div class="odds-comparison-row">
                        <span>${sb.name}</span>
                        <span class="odds-value">${this.formatAmericanOdds(sb.odds)}</span>
                    </div>`
                ).join('')
            : '<p class="no-odds">No odds comparison available</p>';

        const otherBetsHtml = bet.otherBets && bet.otherBets.length > 0
            ? bet.otherBets.map(ob => `
                <div class="other-bet-row">
                    <div class="other-bet-info">
                        <span class="other-bet-type">${ob.type || 'Unknown'}: ${ob.pick || 'Unknown'}</span>
                        ${ob.odds ? `<span class="other-bet-odds">${this.formatAmericanOdds(ob.odds)}</span>` : ''}
                    </div>
                    ${ob.value ? `<div class="other-bet-value ${this.getValueClass(ob.value)}">Value: ${(ob.value * 100).toFixed(0)}%</div>` : ''}
                </div>`
            ).join('')
            : '<p class="no-other-bets">No additional bets available</p>';

        const confidenceBadgeClass = this.getConfidenceBadgeClass(bet.mainBet.confidence || "Medium");

        modalContent.innerHTML = `
            <div class="modal-section">
                <div class="modal-header-row">
                    <div class="bet-meta">
                        <span class="modal-sport">${bet.sport || 'Unknown Sport'}</span>
                        <span class="modal-time">${this.formatDate(bet.time)}</span>
                    </div>
                    <span class="modal-confidence ${confidenceBadgeClass}">${bet.mainBet.confidence || 'Medium'} Confidence</span>
                </div>
                
                <div class="main-bet-highlight">
                    <div class="bet-meta-row">
                        <span class="bet-type-label">${bet.mainBet.type || 'Unknown Type'}</span>
                        ${bet.mainBet.value ? `<span class="value-badge ${this.getValueClass(bet.mainBet.value)}">Value: ${(bet.mainBet.value * 100).toFixed(0)}%</span>` : ''}
                    </div>
                    <div class="bet-selection-row">
                        <div class="bet-pick">${bet.mainBet.pick}</div>
                        ${bet.mainBet.odds ? `<div class="bet-odds ${this.getValueClass(bet.mainBet.value || 0)}">${this.formatAmericanOdds(bet.mainBet.odds)}</div>` : ''}
                    </div>
                    ${bet.mainBet.probability ? `
                    <div class="implied-prob">
                        Implied Probability: ${(bet.mainBet.probability * 100).toFixed(0)}%
                    </div>` : ''}
                </div>
            </div>

            <div class="modal-grid">
                <div class="modal-column">
                    <h3 class="modal-subtitle">Other Opportunities</h3>
                    <div class="other-bets-container">
                        ${otherBetsHtml}
                    </div>
                </div>
                
                <div class="modal-column">
                    <h3 class="modal-subtitle">Odds Comparison</h3>
                    <div class="odds-comparison-container">
                        ${sportsBookComparison}
                    </div>
                </div>
            </div>
            
            ${bet.analysis ? `
            <div class="modal-section">
                <h3 class="modal-subtitle">Summary</h3>
                <div class="analysis-container">
                    <p>${bet.analysis}</p>
                </div>
            </div>` : ''}
            
            ${bet.aiReasoning ? `
            <div class="modal-section">
                <h3 class="modal-subtitle ai-title">
                    <i class="fas fa-brain text-primary"></i>
                    AI Analysis
                </h3>
                <div class="ai-analysis-container">
                    <p>${bet.aiReasoning}</p>
                </div>
            </div>` : ''}
        `;
        
        document.getElementById('detailModal')?.classList.add('active');
    }

    hideDetailModal() {
        document.getElementById('detailModal')?.classList.remove('active');
    }

    showGameModal() {
        document.getElementById('gameModal')?.classList.add('active');
    }

    hideGameModal() {
        document.getElementById('gameModal')?.classList.remove('active');
    }

    updateGameProgress() {
        document.querySelectorAll('.diamond').forEach(diamond => {
            const day = parseInt(diamond.getAttribute('data-day'));
            diamond.style.backgroundColor = '';
            diamond.querySelector('span').style.color = '';
            
            if (day < this.gameData.currentDay) {
                diamond.style.backgroundColor = 'var(--secondary)';
                diamond.querySelector('span').style.color = 'var(--white)';
            } else if (day === this.gameData.currentDay) {
                diamond.style.backgroundColor = 'var(--primary)';
                diamond.querySelector('span').style.color = 'var(--white)';
            } else {
                diamond.style.backgroundColor = 'var(--gray-200)';
                diamond.querySelector('span').style.color = 'var(--gray-700)';
                
                if (document.body.classList.contains('dark')) {
                    diamond.style.backgroundColor = 'var(--gray-700)';
                    diamond.querySelector('span').style.color = 'var(--gray-300)';
                }
            }
        });
    }

    completeCurrentDay(won = true) {
        const currentBet = this.gameData.bets.find(bet => bet.day === this.gameData.currentDay);
        
        if (currentBet && !currentBet.completed) {
            currentBet.completed = true;
            currentBet.won = won;
            
            if (won) {
                this.gameData.currentAmount += currentBet.potentialProfit;
                this.gameData.completedDays++;
                this.gameData.currentDay++;
                
                const diamond = document.querySelector(`.diamond[data-day="${this.gameData.currentDay - 1}"]`);
                if (diamond) {
                    diamond.classList.add('diamond-pulse');
                    setTimeout(() => {
                        diamond.classList.remove('diamond-pulse');
                    }, 1500);
                }
                
                if (this.gameData.currentDay <= 9) {
                    this.gameData.bets.push({
                        day: this.gameData.currentDay,
                        sport: ['NHL', 'NBA', 'UFC', 'Soccer', 'Table Tennis'][Math.floor(Math.random() * 5)],
                        event: "Next Game TBD",
                        bet: "TBD",
                        betType: "TBD",
                        odds: +130,
                        amount: this.gameData.currentAmount,
                        potentialProfit: (this.gameData.currentAmount * 1.3).toFixed(2),
                        completed: false,
                        won: null
                    });
                }
            } else {
                alert("Sorry! You lost today's bet. The Game is over. You can restart from Day 1.");
                this.resetGame();
            }
            
            this.updateGameProgress();
        }
    }

    resetGame() {
        this.gameData.currentDay = 1;
        this.gameData.completedDays = 0;
        this.gameData.currentAmount = this.gameData.startingAmount;
        
        this.gameData.bets = [{
            day: 1,
            sport: "UFC",
            event: "Jon Jones vs Stipe Miocic",
            bet: "Jon Jones",
            betType: "Moneyline",
            odds: -180,
            amount: 10,
            potentialProfit: 15,
            completed: false,
            won: null
        }];
        
        this.updateGameProgress();
    }

    toggleDarkMode() {
        document.body.classList.toggle('dark');
        const darkModeToggle = document.getElementById('darkModeToggle');
        if (darkModeToggle) {
            const moonIcon = darkModeToggle.querySelector('.fa-moon');
            const sunIcon = darkModeToggle.querySelector('.fa-sun');
            
            moonIcon.classList.toggle('hidden');
            sunIcon.classList.toggle('hidden');
        }
    }

    checkDarkMode() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark');
            const darkModeToggle = document.getElementById('darkModeToggle');
            if (darkModeToggle) {
                const moonIcon = darkModeToggle.querySelector('.fa-moon');
                const sunIcon = darkModeToggle.querySelector('.fa-sun');
                
                moonIcon.classList.add('hidden');
                sunIcon.classList.remove('hidden');
            }
        }
        
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (event.matches) {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        });
    }

    formatAmericanOdds(odds) {
        if (odds === null || odds === undefined) return 'N/A';
        return odds > 0 ? `+${odds}` : odds;
    }

    getValueClass(value) {
        if (!value) return "value-low";
        if (value >= 0.25) return "value-high";
        if (value >= 0.15) return "value-medium";
        return "value-low";
    }

    getConfidenceBadgeClass(confidence) {
        switch (confidence) {
            case "High": return "confidence-high";
            case "Medium": return "confidence-medium";
            default: return "confidence-low";
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'TBD';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return 'TBD';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('appContent').style.display = 'none';
    document.getElementById('loadingSpinner').style.display = 'flex';
    new BetSmartApp();
});

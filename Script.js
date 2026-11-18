// ==========================================================================
// 1. AUTHENTICATION & ROUTING LOGIC
// ==========================================================================
const isLoginPage = document.getElementById('login-form') !== null;

if (isLoginPage) {
    if (localStorage.getItem('isLoggedIn') === 'true') { window.location.href = 'Prototype.html'; }

    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginError = document.getElementById('login-error');

    window.toggleAuthView = function(view) {
        if (view === 'register') {
            loginView.classList.add('hidden'); registerView.classList.remove('hidden'); loginError.classList.add('hidden'); 
        } else {
            registerView.classList.add('hidden'); loginView.classList.remove('hidden'); loginError.classList.add('hidden');
        }
    };

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        localStorage.setItem('studsBudgeUser', JSON.stringify({ name, email, password }));
        alert("Account created successfully! Please log in.");
        toggleAuthView('login');
        document.getElementById('login-email').value = email;
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const savedUser = JSON.parse(localStorage.getItem('studsBudgeUser'));

        if (savedUser && savedUser.email === email && savedUser.password === password) {
            localStorage.setItem('isLoggedIn', 'true');
            window.location.href = 'Prototype.html'; 
        } else {
            loginError.classList.remove('hidden');
        }
    });
} 

// ==========================================================================
// 2. DASHBOARD / PROTOTYPE LOGIC (Prototype.html)
// ==========================================================================
if (!isLoginPage) {
    if (localStorage.getItem('isLoggedIn') !== 'true') { window.location.href = 'login.html'; }

    window.logout = function() {
        localStorage.removeItem('isLoggedIn');
        window.location.href = 'login.html';
    };

    // --- State Management ---
    let transactions = [];
    let totalIncome = 0;
    let totalExpenses = 0;

    const budgets = { food: 1500, transport: 500, entertainment: 800 };
    let categorySpending = { food: 0, transport: 0, entertainment: 0 };

    // --- DOM Elements ---
    const form = document.getElementById('transaction-form');
    const typeInput = document.getElementById('type');
    const descInput = document.getElementById('description');
    const amountInput = document.getElementById('amount');
    const categoryInput = document.getElementById('category');
    const transactionList = document.getElementById('transaction-list');
    const themeToggleBtn = document.getElementById('theme-toggle');

    // Over-budget Warning Elements
    const globalWarning = document.getElementById('global-over-budget-warning');
    const globalWarningText = document.getElementById('global-warning-text');
    const overBudgetAlert = document.getElementById('over-budget-alert');
    const overBudgetText = document.getElementById('over-budget-text');

    const elTotalIncome = document.getElementById('total-income');
    const elTotalExpenses = document.getElementById('total-expenses');
    const elRemainingBalance = document.getElementById('remaining-balance');

    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete');
    const cancelDeleteBtn = document.getElementById('cancel-delete');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    let transactionToDeleteId = null;
    let dashboardChart = null; 
    let reportsChart = null;   

    // --- Theme Logic ---
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }

    function updateThemeIcon(theme) {
        themeToggleBtn.innerHTML = theme === 'light' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    }

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        updateChartColors(newTheme);
    });

    function updateChartColors(theme) {
        const textColor = theme === 'light' ? '#0f172a' : '#94a3b8';
        const gridColor = theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        const borderColor = theme === 'light' ? '#ffffff' : 'rgba(15, 23, 42, 1)';
        Chart.defaults.color = textColor;
        if (dashboardChart) { dashboardChart.options.scales.y.grid.color = gridColor; dashboardChart.update(); }
        if (reportsChart) { reportsChart.data.datasets[0].borderColor = borderColor; reportsChart.update(); }
    }

    // --- Core Functions ---
    const formatMoney = (amount) => 'R ' + amount.toFixed(2);

    window.switchView = function(viewName) {
        document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
        document.getElementById(`nav-${viewName}`).classList.add('active');
        document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('hidden'));

        if (viewName === 'dashboard') {
            document.getElementById('dashboard-section').classList.remove('hidden');
        } else if (viewName === 'reports') {
            document.getElementById('reports-section').classList.remove('hidden');
            renderReportsChart(); 
        }
    }

    function showToast(message, type = 'success') {
        toastMessage.innerText = message;
        if (type === 'error') {
            toast.style.background = 'rgba(239, 68, 68, 0.9)'; toast.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.4)';
            toast.querySelector('i').className = 'fa-solid fa-circle-exclamation';
        } else if (type === 'warning') {
            toast.style.background = 'rgba(245, 158, 11, 0.95)'; toast.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.4)';
            toast.querySelector('i').className = 'fa-solid fa-triangle-exclamation';
        } else {
            toast.style.background = 'rgba(16, 185, 129, 0.9)'; toast.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';
            toast.querySelector('i').className = 'fa-solid fa-circle-check';
        }
        toast.classList.remove('hidden');
        setTimeout(() => { toast.classList.add('hidden'); }, 4000); 
    }

    window.shareProgress = function() {
        const balance = totalIncome - totalExpenses;
        let message = balance < 0 
            ? `I'm currently R${Math.abs(balance).toFixed(2)} over budget this month! Time to cut back. 😅 #StudsBudge`
            : `I'm staying on track with my budget! I still have R${balance.toFixed(2)} left for the month. 💪📉 #StudsBudge`;

        navigator.clipboard.writeText(message).then(() => {
            showToast("Progress copied! Share it with friends.");
        }).catch(() => {
            showToast("Failed to copy text.", 'error');
        });
    }

    function updateUI() {
        totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        
        elTotalIncome.innerText = formatMoney(totalIncome);
        elTotalExpenses.innerText = formatMoney(totalExpenses);
        
        const balance = totalIncome - totalExpenses;
        elRemainingBalance.innerText = formatMoney(balance);
        
        if (balance < 0) { elRemainingBalance.classList.add('text-red'); } 
        else { elRemainingBalance.classList.remove('text-red'); }

        categorySpending = { food: 0, transport: 0, entertainment: 0 };
        transactions.filter(t => t.type === 'expense').forEach(t => {
            if (categorySpending[t.category] !== undefined) { categorySpending[t.category] += t.amount; }
        });

        updateProgressBar('food', categorySpending.food, budgets.food, 'Food & Groceries');
        updateProgressBar('transport', categorySpending.transport, budgets.transport, 'Transport');
        updateProgressBar('entertainment', categorySpending.entertainment, budgets.entertainment, 'Entertainment');

        renderTransactions();
        renderDashboardChart(); 
    }

    // --- UPDATED: Emotional Interaction / Over-Budget Logic ---
    let isAnyCategoryOverBudget = false;
    let overBudgetMessages = [];

    function updateProgressBar(category, spent, limit, categoryName) {
        const bar = document.getElementById(`${category}-bar`);
        const text = document.getElementById(`${category}-text`);
        
        text.innerText = `${formatMoney(spent)} / ${formatMoney(limit)}`;

        let percentage = (spent / limit) * 100;
        if (percentage > 100) percentage = 100;
        bar.style.width = `${percentage}%`;

        if (spent > limit) { 
            bar.classList.add('danger');
            bar.classList.remove('warning'); 
            
            // Track that this category is over budget
            isAnyCategoryOverBudget = true;
            overBudgetMessages.push(`${categoryName} (R${(spent - limit).toFixed(2)} over)`);
            
        } 
        else if (spent > (limit * 0.8)) { 
            bar.classList.add('warning'); 
            bar.classList.remove('danger'); 
        } 
        else { 
            bar.classList.remove('warning', 'danger'); 
        }
    }

    // Function to update the global warning banner
    function updateGlobalWarningUI() {
        // Reset tracker before checking
        isAnyCategoryOverBudget = false;
        overBudgetMessages = [];

        // Check all categories
        if (categorySpending.food > budgets.food) {
            isAnyCategoryOverBudget = true;
            overBudgetMessages.push("Food & Groceries");
        }
        if (categorySpending.transport > budgets.transport) {
            isAnyCategoryOverBudget = true;
            overBudgetMessages.push("Transport");
        }
        if (categorySpending.entertainment > budgets.entertainment) {
            isAnyCategoryOverBudget = true;
            overBudgetMessages.push("Entertainment");
        }

        // Update the UI banner
        if (isAnyCategoryOverBudget) {
            globalWarning.classList.remove('hidden');
            // Use a supportive, non-aggressive tone
            globalWarningText.innerText = `You've gone a little over your ${overBudgetMessages.join(' and ')} budget. Consider adjusting your spending for the rest of the week.`;
        } else {
            globalWarning.classList.add('hidden');
        }
    }

    function renderTransactions() {
        transactionList.innerHTML = '';
        if (transactions.length === 0) {
            transactionList.innerHTML = '<li style="justify-content:center; color: var(--text-muted);">No recent activity. Log something above!</li>';
            return;
        }

        [...transactions].reverse().forEach(t => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <span class="t-desc">${t.description}</span>
                    <span class="t-cat">${t.category.toUpperCase()}</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <span class="t-amount ${t.type}">${t.type === 'income' ? '+' : '-'} ${formatMoney(t.amount)}</span>
                    <button class="btn-delete" onclick="promptDelete(${t.id})" aria-label="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            transactionList.appendChild(li);
        });
    }

    function renderDashboardChart() {
        const ctx = document.getElementById('dashboardBarChart').getContext('2d');
        if (dashboardChart) { dashboardChart.destroy(); }

        const currentTheme = document.documentElement.getAttribute('data-theme');
        const gridColor = currentTheme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        
        let gradientFood = ctx.createLinearGradient(0, 0, 0, 200);
        gradientFood.addColorStop(0, '#8b5cf6'); gradientFood.addColorStop(1, 'rgba(139, 92, 246, 0.1)');
        let gradientTrans = ctx.createLinearGradient(0, 0, 0, 200);
        gradientTrans.addColorStop(0, '#06b6d4'); gradientTrans.addColorStop(1, 'rgba(6, 182, 212, 0.1)');
        let gradientEnt = ctx.createLinearGradient(0, 0, 0, 200);
        gradientEnt.addColorStop(0, '#ec4899'); gradientEnt.addColorStop(1, 'rgba(236, 72, 153, 0.1)');

        dashboardChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Food', 'Transport', 'Fun'],
                datasets: [{
                    label: 'Spent (R)',
                    data: [categorySpending.food, categorySpending.transport, categorySpending.entertainment],
                    backgroundColor: [gradientFood, gradientTrans, gradientEnt],
                    borderColor: ['#8b5cf6', '#06b6d4', '#ec4899'],
                    borderWidth: 2,
                    borderRadius: 8,
                    barThickness: 30
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: gridColor } },
                    x: { grid: { display: false } }
                },
                animation: { duration: 800, easing: 'easeOutQuart' }
            }
        });
    }

    function renderReportsChart() {
        const ctx = document.getElementById('expenseChart').getContext('2d');
        if (reportsChart) { reportsChart.destroy(); }

        const currentTheme = document.documentElement.getAttribute('data-theme');
        const borderColor = currentTheme === 'light' ? '#ffffff' : 'rgba(15, 23, 42, 1)';

        if (categorySpending.food === 0 && categorySpending.transport === 0 && categorySpending.entertainment === 0) {
            reportsChart = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['No expenses yet'], datasets: [{ data: [1], backgroundColor: ['rgba(148, 163, 184, 0.2)'] }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }
            });
            return;
        }

        reportsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Food & Groceries', 'Transport', 'Entertainment'],
                datasets: [{
                    data: [categorySpending.food, categorySpending.transport, categorySpending.entertainment],
                    backgroundColor: ['#8b5cf6', '#06b6d4', '#ec4899'],
                    borderColor: borderColor,
                    borderWidth: 4,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'bottom', labels: { padding: 20, usePointStyle: true } } },
                animation: { animateScale: true, animateRotate: true }
            }
        });
    }

    // --- Event Listeners ---
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = typeInput.value;
        const description = descInput.value;
        const amount = parseFloat(amountInput.value);
        const category = categoryInput.value;

        if (isNaN(amount) || amount <= 0) {
            showToast("Please enter a valid amount.", 'error');
            return;
        }

        const newTransaction = { id: Date.now(), type, description, amount, category: type === 'income' ? 'income' : category };
        
        transactions.push(newTransaction);
        form.reset();
        updateUI();
        updateGlobalWarningUI(); // Trigger the new UI warning

        // Toast notification logic
        if (category === 'entertainment' && type === 'expense' && categorySpending.entertainment > budgets.entertainment) {
            showToast("You've gone a little over your entertainment budget. Consider adjusting your spending for the rest of the week.", 'warning');
        } else {
            showToast("Transaction successfully added!");
        }
    });

    window.promptDelete = function(id) {
        transactionToDeleteId = id;
        deleteModal.classList.remove('hidden');
    }

    cancelDeleteBtn.addEventListener('click', () => {
        deleteModal.classList.add('hidden');
        transactionToDeleteId = null;
    });

    confirmDeleteBtn.addEventListener('click', () => {
        transactions = transactions.filter(t => t.id !== transactionToDeleteId);
        deleteModal.classList.add('hidden');
        transactionToDeleteId = null;
        updateUI();
        updateGlobalWarningUI(); // Re-check if they are back under budget
        showToast("Transaction deleted.");
    });

    // Initialize on load
    initTheme();
    updateUI();
    updateGlobalWarningUI();
}
'use strict';

// Storage keys
const STORAGE_KEY = 'ledger-transactions-v1';
const BUDGET_KEY = 'ledger-monthly-budget-v1';
const THEME_KEY = 'ledger-theme-v1';

// Expense categories
const CATEGORIES = [
    'Food',
    'Shopping',
    'Transportation',
    'Education',
    'Entertainment',
    'Health',
    'Bills',
    'Other'
];

const CATEGORY_COLORS = [
    '#6f9b7d',
    '#d49a70',
    '#7b86a8',
    '#b49bca',
    '#d1b96e',
    '#6da6a4',
    '#c17e7e',
    '#9aa39c'
];

// Application data
let transactions = loadTransactions();
let monthlyBudget = Number(localStorage.getItem(BUDGET_KEY)) || 10000;
let editingId = null;

let cashFlowChart = null;
let categoryChart = null;
let toastTimer = null;

// Shortcut for selecting HTML elements
const $ = (selector) => document.querySelector(selector);


// Format currency in Indian Rupees
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    }).format(amount);
};


// Get today's date in YYYY-MM-DD format
function today() {
    const date = new Date();

    const localDate = new Date(
        date.getTime() - date.getTimezoneOffset() * 60000
    );

    return localDate.toISOString().slice(0, 10);
}


// Format date for displaying
function formatDate(value) {
    return new Date(`${value}T00:00:00`).toLocaleDateString(
        'en-IN',
        {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }
    );
}


// Get month and year from date
function getMonthKey(date) {
    const d = new Date(`${date}T00:00:00`);

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, '0')}`;
}


// Escape user-entered text before inserting it into HTML
function safeText(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}


// Load transactions from LocalStorage
function loadTransactions() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || '[]'
        );

        return Array.isArray(saved)
            ? saved.filter((item) =>
                item &&
                typeof item.title === 'string' &&
                Number.isFinite(Number(item.amount)) &&
                ['income', 'expense'].includes(item.type) &&
                CATEGORIES.includes(item.category)
            )
            : [];

    } catch (error) {
        return [];
    }
}


// Save transactions to LocalStorage
function saveTransactions() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(transactions)
    );
}


// Show notification
function showToast(message) {
    const toast = $('#toast');

    toast.textContent = message;
    toast.classList.add('show');

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2400);
}


// Calculate total income and expenses
function getTotals(items = transactions) {

    return items.reduce((totals, item) => {

        totals[item.type] += Number(item.amount);

        return totals;

    }, {
        income: 0,
        expense: 0
    });
}


// Update dashboard statistics
function renderDashboard() {

    const totals = getTotals();

    const currentMonth = getMonthKey(today());

    const monthExpenses = transactions
        .filter((item) =>
            item.type === 'expense' &&
            getMonthKey(item.date) === currentMonth
        )
        .reduce((sum, item) =>
            sum + Number(item.amount), 0
        );

    const balance = totals.income - totals.expense;

    $('#totalBalance').textContent =
        formatCurrency(balance);

    $('#totalIncome').textContent =
        formatCurrency(totals.income);

    $('#totalExpenses').textContent =
        formatCurrency(totals.expense);

    $('#monthSpending').textContent =
        formatCurrency(monthExpenses);

    $('#monthLabel').textContent =
        new Date().toLocaleDateString('en-IN', {
            month: 'long',
            year: 'numeric'
        });

    renderBudget(monthExpenses);

    renderCharts();
}


// Update monthly budget
function renderBudget(spent) {

    const percent = monthlyBudget > 0
        ? (spent / monthlyBudget) * 100
        : 0;

    const remaining = monthlyBudget - spent;

    $('#budgetSpent').textContent =
        formatCurrency(spent);

    $('#budgetLimitText').textContent =
        `of ${formatCurrency(monthlyBudget)}`;

    $('#budgetProgress').style.width =
        `${Math.min(percent, 100)}%`;

    $('#budgetProgress').classList.toggle(
        'over',
        percent > 100
    );

    $('#budgetPercent').textContent =
        `${Math.round(percent)}% used`;

    $('#budgetRemaining').textContent =
        remaining >= 0
            ? `${formatCurrency(remaining)} left`
            : `${formatCurrency(Math.abs(remaining))} over`;

    if (percent > 100) {

        $('#budgetTip').textContent =
            'You are over this month’s limit. Review your recent spending.';

    } else if (percent >= 80) {

        $('#budgetTip').textContent =
            'You are getting close to your monthly limit.';

    } else {

        $('#budgetTip').textContent =
            'A budget gives every rupee a direction.';
    }
}


// Generate monthly chart labels
function monthSeries(count) {

    const months = [];

    const now = new Date();

    for (let offset = count - 1; offset >= 0; offset--) {

        const date = new Date(
            now.getFullYear(),
            now.getMonth() - offset,
            1
        );

        months.push({

            key: `${date.getFullYear()}-${String(
                date.getMonth() + 1
            ).padStart(2, '0')}`,

            label: date.toLocaleDateString('en-IN', {
                month: 'short'
            })

        });
    }

    return months;
}


// Create and update charts
function renderCharts() {

    if (typeof Chart === 'undefined') {
        return;
    }

    const count = Number($('#chartPeriod').value || 6);

    const months = monthSeries(count);


    // Calculate income for each month
    const incomeData = months.map((month) => {

        return transactions
            .filter((item) =>
                item.type === 'income' &&
                getMonthKey(item.date) === month.key
            )
            .reduce((sum, item) =>
                sum + Number(item.amount), 0
            );

    });


    // Calculate expenses for each month
    const expenseData = months.map((month) => {

        return transactions
            .filter((item) =>
                item.type === 'expense' &&
                getMonthKey(item.date) === month.key
            )
            .reduce((sum, item) =>
                sum + Number(item.amount), 0
            );

    });


    // Common chart settings
    const commonOptions = {

        responsive: true,

        maintainAspectRatio: false,

        plugins: {

            legend: {
                display: false
            },

            tooltip: {

                callbacks: {

                    label: (context) => {

                        return `${context.dataset.label}: ${
                            formatCurrency(context.raw)
                        }`;

                    }

                }

            }

        },

        scales: {

            x: {

                grid: {
                    display: false
                },

                ticks: {
                    color: '#929b94',
                    font: {
                        size: 10
                    }
                },

                border: {
                    display: false
                }

            },

            y: {

                beginAtZero: true,

                grid: {
                    color: 'rgba(140,150,142,.13)'
                },

                ticks: {

                    color: '#929b94',

                    font: {
                        size: 9
                    },

                    callback: (value) => {

                        return value >= 1000
                            ? `₹${value / 1000}k`
                            : `₹${value}`;

                    }

                },

                border: {
                    display: false
                }

            }

        }

    };


    // Income vs expenses bar chart
    if (cashFlowChart) {
        cashFlowChart.destroy();
    }

    cashFlowChart = new Chart(
        $('#cashFlowChart'),
        {

            type: 'bar',

            data: {

                labels: months.map((month) => month.label),

                datasets: [

                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: '#79a287',
                        borderRadius: 4,
                        maxBarThickness: 19
                    },

                    {
                        label: 'Expenses',
                        data: expenseData,
                        backgroundColor: '#d6a07b',
                        borderRadius: 4,
                        maxBarThickness: 19
                    }

                ]

            },

            options: commonOptions

        }
    );


    // Calculate category-wise expenses
    const categoryTotals = CATEGORIES.map((category) => {

        return {

            category,

            total: transactions
                .filter((item) =>
                    item.type === 'expense' &&
                    item.category === category
                )
                .reduce((sum, item) =>
                    sum + Number(item.amount), 0
                )

        };

    }).filter((item) => item.total > 0);


    // Expense category doughnut chart
    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(
        $('#categoryChart'),
        {

            type: 'doughnut',

            data: {

                labels: categoryTotals.map(
                    (item) => item.category
                ),

                datasets: [

                    {

                        data: categoryTotals.length
                            ? categoryTotals.map((item) => item.total)
                            : [1],

                        backgroundColor: categoryTotals.length
                            ? categoryTotals.map((item) =>
                                CATEGORY_COLORS[
                                    CATEGORIES.indexOf(item.category)
                                ]
                            )
                            : ['#e9ede9'],

                        borderWidth: 0,

                        hoverOffset: 4

                    }

                ]

            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                cutout: '70%',

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {

                        enabled: categoryTotals.length > 0,

                        callbacks: {

                            label: (context) => {

                                return `${context.label}: ${
                                    formatCurrency(context.raw)
                                }`;

                            }

                        }

                    }

                }

            }

        }
    );


    // Category legend
    $('#categoryLegend').innerHTML = categoryTotals.length

        ? categoryTotals.slice(0, 6).map((item) => {

            const color = CATEGORY_COLORS[
                CATEGORIES.indexOf(item.category)
            ];

            return `
                <div class="category-item">

                    <i class="legend-dot"
                       style="background:${color}">
                    </i>

                    <span>${safeText(item.category)}</span>

                    <strong>
                        ${formatCurrency(item.total)}
                    </strong>

                </div>
            `;

        }).join('')

        : `
            <div class="category-item"
                 style="grid-column:1/-1;color:#9aa39c">

                Your expense breakdown will appear here.

            </div>
        `;
}


// Filter and sort transactions
function getFilteredTransactions() {

    const query = $('#searchInput').value
        .trim()
        .toLowerCase();

    const type = $('#typeFilter').value;

    const category = $('#categoryFilter').value;

    const dateFilter = $('#dateFilter').value;

    const sort = $('#sortFilter').value;

    const now = new Date();

    const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );


    return transactions

        .filter((item) => {

            const matchesQuery =
                item.title.toLowerCase().includes(query) ||
                (item.description || '').toLowerCase().includes(query);

            const matchesType =
                type === 'all' || item.type === type;

            const matchesCategory =
                category === 'all' || item.category === category;

            const itemDate = new Date(
                `${item.date}T00:00:00`
            );

            let matchesDate = true;


            if (dateFilter === 'month') {

                matchesDate =
                    getMonthKey(item.date) === getMonthKey(today());

            }


            if (dateFilter === 'year') {

                matchesDate =
                    itemDate.getFullYear() === now.getFullYear();

            }


            if (dateFilter === '30') {

                const daysAgo = new Date(startOfToday);

                daysAgo.setDate(daysAgo.getDate() - 29);

                matchesDate =
                    itemDate >= daysAgo &&
                    itemDate <= startOfToday;

            }


            return (
                matchesQuery &&
                matchesType &&
                matchesCategory &&
                matchesDate
            );

        })


        // Sorting
        .sort((a, b) => {

            return sort === 'newest'

                ? b.date.localeCompare(a.date) ||
                  b.createdAt - a.createdAt

                : a.date.localeCompare(b.date) ||
                  a.createdAt - b.createdAt;

        });
}


// Display transactions in table
function renderTransactions() {

    const filtered = getFilteredTransactions();

    const rows = $('#transactionRows');


    $('#emptyState').classList.toggle(
        'show',
        filtered.length === 0
    );

    $('.table-scroll').style.display =
        filtered.length ? 'block' : 'none';


    $('#tableFooter').textContent = filtered.length

        ? `Showing ${filtered.length} of ${
            transactions.length
        } transactions`

        : '';


    rows.innerHTML = filtered.slice(0, 100).map((item) => {

        return `

            <tr>

                <td>
                    ${safeText(item.title)}

                    ${item.description
                        ? `<div style="font-weight:400;color:#a0a8a1;margin-top:3px">
                            ${safeText(item.description)}
                           </div>`
                        : ''
                    }
                </td>

                <td>${safeText(item.category)}</td>

                <td>${formatDate(item.date)}</td>

                <td>
                    <span class="type-pill ${item.type}">
                        ${item.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                </td>

                <td class="amount">
                    ${item.type === 'income' ? '+' : '−'}
                    ${formatCurrency(Number(item.amount))}
                </td>

                <td>

                    <div class="row-actions">

                        <button
                            type="button"
                            data-action="edit"
                            data-id="${safeText(item.id)}"
                            aria-label="Edit transaction"
                            title="Edit"
                        >
                            ✎
                        </button>

                        <button
                            type="button"
                            data-action="delete"
                            data-id="${safeText(item.id)}"
                            aria-label="Delete transaction"
                            title="Delete"
                        >
                            ×
                        </button>

                    </div>

                </td>

            </tr>

        `;

    }).join('');
}


// Refresh entire application
function renderAll() {

    renderDashboard();

    renderTransactions();

}


// Populate category dropdowns
function populateCategories() {

    $('#transactionCategory').innerHTML =
        CATEGORIES.map((category) => {

            return `
                <option value="${category}">
                    ${category}
                </option>
            `;

        }).join('');


    $('#categoryFilter').innerHTML =
        '<option value="all">All categories</option>' +

        CATEGORIES.map((category) => {

            return `
                <option value="${category}">
                    ${category}
                </option>
            `;

        }).join('');
}


// Open add/edit modal
function openModal(transaction = null) {

    editingId = transaction ? transaction.id : null;

    $('#transactionForm').reset();

    $('#transactionType').value =
        transaction?.type || 'expense';

    $('#titleInput').value =
        transaction?.title || '';

    $('#amountInput').value =
        transaction?.amount ?? '';

    $('#transactionCategory').value =
        transaction?.category || 'Food';

    $('#transactionDate').value =
        transaction?.date || today();

    $('#descriptionInput').value =
        transaction?.description || '';

    updateTypeButtons();

    $('#modalTitle').textContent =
        transaction ? 'Edit transaction' : 'Add transaction';

    $('#saveTransactionBtn').textContent =
        transaction ? 'Save changes' : 'Save transaction';

    $('#transactionModal').classList.add('open');

    $('#transactionModal').setAttribute(
        'aria-hidden',
        'false'
    );

    setTimeout(() => {
        $('#titleInput').focus();
    }, 50);

}


// Close modal
function closeModal() {

    $('#transactionModal').classList.remove('open');

    $('#transactionModal').setAttribute(
        'aria-hidden',
        'true'
    );

    editingId = null;

}


// Update income/expense buttons
function updateTypeButtons() {

    document.querySelectorAll('.type-option').forEach((button) => {

        button.classList.toggle(
            'active',
            button.dataset.type === $('#transactionType').value
        );

    });

}


// Add or update transaction
function handleTransactionSubmit(event) {

    event.preventDefault();

    const title = $('#titleInput').value.trim();

    const amount = Number($('#amountInput').value);

    const type = $('#transactionType').value;

    const category = $('#transactionCategory').value;

    const date = $('#transactionDate').value;


    // Validation
    if (!title || title.length > 50) {

        return showToast('Please enter a valid title.');

    }

    if (!Number.isFinite(amount) || amount <= 0) {

        return showToast('Amount must be greater than zero.');

    }

    if (!CATEGORIES.includes(category)) {

        return showToast('Please choose a valid category.');

    }

    if (!date || date > today()) {

        return showToast('Choose a valid date (today or earlier).');

    }


    // Create transaction object
    const record = {

        id: editingId ||
            (window.crypto?.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`),

        title,

        amount: Math.round(amount * 100) / 100,

        type,

        category,

        date,

        description: $('#descriptionInput').value.trim(),

        createdAt: editingId

            ? transactions.find(
                (item) => item.id === editingId
            )?.createdAt || Date.now()

            : Date.now()

    };


    // Update or add transaction
    if (editingId) {

        transactions = transactions.map((item) => {

            return item.id === editingId ? record : item;

        });

    } else {

        transactions.push(record);

    }


    saveTransactions();

    closeModal();

    renderAll();

    showToast(
        editingId
            ? 'Transaction updated.'
            : 'Transaction added.'
    );

}


// Handle edit and delete buttons
function handleRowAction(event) {

    const button = event.target.closest(
        'button[data-action]'
    );

    if (!button) return;

    const transaction = transactions.find(
        (item) => item.id === button.dataset.id
    );

    if (!transaction) return;


    // Edit transaction
    if (button.dataset.action === 'edit') {

        openModal(transaction);

    }


    // Delete transaction
    if (button.dataset.action === 'delete') {

        const confirmed = confirm(
            `Delete "${transaction.title}"? This cannot be undone.`
        );

        if (!confirmed) return;

        transactions = transactions.filter(
            (item) => item.id !== transaction.id
        );

        saveTransactions();

        renderAll();

        showToast('Transaction deleted.');

    }

}


// Export transaction history as CSV
function downloadCSV() {

    if (!transactions.length) {

        return showToast('There are no transactions to export.');

    }

    const headers = [
        'Title',
        'Amount',
        'Type',
        'Category',
        'Date',
        'Description'
    ];

    const csvRows = [

        headers,

        ...transactions.map((item) => [

            item.title,
            item.amount,
            item.type,
            item.category,
            item.date,
            item.description || ''

        ])

    ];


    const csv = csvRows.map((row) => {

        return row.map((value) => {

            return `"${String(value).replace(/"/g, '""')}"`;

        }).join(',');

    }).join('\r\n');


    const blob = new Blob(
        ['\uFEFF' + csv],
        {
            type: 'text/csv;charset=utf-8;'
        }
    );


    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    link.download = `ledger-transactions-${today()}.csv`;

    link.click();

    URL.revokeObjectURL(url);

    showToast('CSV export downloaded.');

}


// Initialize application
function init() {

    populateCategories();


    // Current date
    $('#todayDate').textContent =
        new Date().toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });


    // Load saved budget
    $('#budgetInput').value = monthlyBudget;


    // Load saved theme
    if (localStorage.getItem(THEME_KEY) === 'dark') {

        document.body.classList.add('dark');

    }


    // Open transaction modal
    ['#addTopBtn', '#emptyAddBtn'].forEach((selector) => {

        $(selector).addEventListener('click', () => {

            openModal();

        });

    });


    // Close modal
    $('#closeModalBtn').addEventListener(
        'click',
        closeModal
    );

    $('#cancelModalBtn').addEventListener(
        'click',
        closeModal
    );


    $('#transactionModal').addEventListener('click', (event) => {

        if (event.target === $('#transactionModal')) {

            closeModal();

        }

    });


    // Transaction form
    $('#transactionForm').addEventListener(
        'submit',
        handleTransactionSubmit
    );


    // Select income or expense
    document.querySelectorAll('.type-option').forEach((button) => {

        button.addEventListener('click', () => {

            $('#transactionType').value = button.dataset.type;

            updateTypeButtons();

        });

    });


    // Edit and delete
    $('#transactionRows').addEventListener(
        'click',
        handleRowAction
    );


    // Search and filters
    [
        '#searchInput',
        '#typeFilter',
        '#categoryFilter',
        '#dateFilter',
        '#sortFilter'
    ].forEach((selector) => {

        $(selector).addEventListener(
            selector === '#searchInput' ? 'input' : 'change',
            renderTransactions
        );

    });


    // Chart period
    $('#chartPeriod').addEventListener(
        'change',
        renderCharts
    );


    // Update budget
    $('#budgetForm').addEventListener('submit', (event) => {

        event.preventDefault();

        const value = Number($('#budgetInput').value);

        if (!Number.isFinite(value) || value <= 0) {

            return showToast('Enter a budget greater than zero.');

        }

        monthlyBudget = Math.round(value * 100) / 100;

        localStorage.setItem(
            BUDGET_KEY,
            String(monthlyBudget)
        );

        renderDashboard();

        showToast('Monthly budget updated.');

    });


    // Clear all transactions
    $('#clearAllBtn').addEventListener('click', () => {

        if (!transactions.length) {

            return showToast('There is no transaction data to clear.');

        }

        const confirmed = confirm(
            'Clear every transaction? This action cannot be undone.'
        );

        if (!confirmed) return;

        transactions = [];

        saveTransactions();

        renderAll();

        showToast('All transaction data cleared.');

    });


    // Dark and light mode
    $('#themeBtn').addEventListener('click', () => {

        document.body.classList.toggle('dark');

        const isDark = document.body.classList.contains('dark');

        localStorage.setItem(
            THEME_KEY,
            isDark ? 'dark' : 'light'
        );

        showToast(
            `${isDark ? 'Dark' : 'Light'} mode enabled.`
        );

    });


    // Mobile navigation
    $('#menuBtn').addEventListener('click', () => {

        $('#sidebar').classList.toggle('open');

    });


    document.querySelectorAll('.side-nav a').forEach((link) => {

        link.addEventListener('click', () => {

            $('#sidebar').classList.remove('open');

        });

    });


    // View all transactions
    $('#viewAllBtn').addEventListener('click', () => {

        $('#searchInput').value = '';

        $('#typeFilter').value = 'all';

        $('#categoryFilter').value = 'all';

        $('#dateFilter').value = 'all';

        $('#sortFilter').value = 'newest';

        renderTransactions();

        $('#transactions').scrollIntoView({
            behavior: 'smooth'
        });

    });


    // CSV export button
    const exportButton = document.createElement('button');

    exportButton.type = 'button';

    exportButton.className = 'text-button';

    exportButton.textContent = '↓ Export CSV';

    exportButton.addEventListener('click', downloadCSV);

    $('.transactions-heading').append(exportButton);


    // Initial dashboard rendering
    renderAll();

}


// Start application after HTML loads
document.addEventListener('DOMContentLoaded', init);
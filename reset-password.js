// Appwrite Configuration
const { Client, Account } = Appwrite;
const client = new Client()
    .setEndpoint('https://appwrite.etihadalmdina.com/v1')
    .setProject('69f21c73000621939422');

const account = new Account(client);

// UI Elements
const resetCard = document.getElementById('reset-card');
const accessDenied = document.getElementById('access-denied');
const successView = document.getElementById('success-view');
const expiredView = document.getElementById('expired-view');
const resetForm = document.getElementById('reset-form');
const statusMessage = document.getElementById('status-message');
const submitBtn = document.getElementById('submit-btn');
const timerDisplay = document.getElementById('timer-display');
const timerBox = document.getElementById('countdown-timer');

// URL Parameters
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('userId');
const secret = urlParams.get('secret');

// Security Tracking Keys
const expiryStorageKey = `reset_time_${secret}`;
const usedStorageKey = `reset_used_${secret}`;

let timeLeft = 90; 
let timerInterval;

// Check Logic
async function checkInitialState() {
    if (!userId || !secret) {
        if (accessDenied) accessDenied.style.display = 'block';
        return;
    }

    // Check if already used
    if (localStorage.getItem(usedStorageKey)) {
        if (expiredView) {
            expiredView.querySelector('h2').innerText = "رابط تم استخدامه";
            expiredView.querySelector('p').innerText = "عفواً، لقد قمت بتحديث كلمة المرور مسبقاً بهذا الرابط. الرابط متاح للاستخدام مرة واحدة فقط.";
            expiredView.style.display = 'block';
        }
        return;
    }

    // Persistence Timer Logic
    const savedExpiryTime = localStorage.getItem(expiryStorageKey);
    const now = Date.now();

    if (savedExpiryTime) {
        const totalExpiry = parseInt(savedExpiryTime);
        const remaining = Math.floor((totalExpiry - now) / 1000);
        
        if (remaining <= 0) {
            handleExpiration();
            return;
        }
        timeLeft = remaining;
    } else {
        const newExpiry = now + (timeLeft * 1000);
        localStorage.setItem(expiryStorageKey, newExpiry.toString());
    }

    if (resetCard) resetCard.style.display = 'block';
    startTimer();
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if (timerDisplay) {
            timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        if (timeLeft <= 30 && timerBox) {
            timerBox.classList.add('timer-low');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            handleExpiration();
        }
    }, 1000);
}

function handleExpiration() {
    if (resetCard) resetCard.style.display = 'none';
    if (expiredView) expiredView.style.display = 'block';
    localStorage.setItem(expiryStorageKey, "0"); 
}

if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (password !== confirmPassword) {
            showStatus('كلمات المرور غير متطابقة!', 'error');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>جاري التحميل...</span>';
            await account.updateRecovery(userId, secret, password, confirmPassword);
            
            localStorage.setItem(usedStorageKey, "true");
            clearInterval(timerInterval);

            if (resetCard) resetCard.style.display = 'none';
            if (successView) successView.style.display = 'block';
        } catch (error) {
            console.error(error);
            showStatus('رابط منتهي الصلاحية أو غير صالح. يرجى طلب رابط جديد.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>تحديث كلمة المرور</span>';
        }
    });
}

function showStatus(msg, type) {
    if (statusMessage) {
        statusMessage.textContent = msg;
        statusMessage.className = `status-msg status-${type}`;
        statusMessage.style.display = 'block';
    }
}

// Start
document.addEventListener('DOMContentLoaded', checkInitialState);

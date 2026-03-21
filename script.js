// ============================================
// KFZ ALTUN — Scripts
// ============================================

// Animated Hero Words — Typewriter Effect
const words = ['Leidenschaft.', 'Präzision.', 'Zuverlässigkeit.', 'Familie.', 'Handwerk.', 'Qualität.'];
let currentIndex = 0;
const heroWord = document.getElementById('heroWord');
const heroCursor = document.querySelector('.hero-cursor');

const TYPE_SPEED = 80;
const DELETE_SPEED = 50;
const BLINK_PAUSE = 1000;

function typeWriter() {
    if (!heroWord) return;
    const word = words[currentIndex];
    let charIndex = 0;

    // Type forward
    function typeChar() {
        if (charIndex <= word.length) {
            heroWord.textContent = word.slice(0, charIndex);
            charIndex++;
            setTimeout(typeChar, TYPE_SPEED);
        } else {
            // Word complete — blink cursor 2 times then delete
            if (heroCursor) heroCursor.style.animation = 'blink 0.5s step-end 4';
            setTimeout(deleteWord, BLINK_PAUSE * 2);
        }
    }

    // Delete backward
    function deleteWord() {
        if (heroCursor) heroCursor.style.animation = 'blink 1s infinite';
        let delIndex = word.length;
        function deleteChar() {
            if (delIndex >= 0) {
                heroWord.textContent = word.slice(0, delIndex);
                delIndex--;
                setTimeout(deleteChar, DELETE_SPEED);
            } else {
                // Move to next word immediately
                currentIndex = (currentIndex + 1) % words.length;
                typeWriter();
            }
        }
        deleteChar();
    }

    typeChar();
}

typeWriter();

// Navigation scroll effect
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// Close mobile menu on link click
navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
    });
});

// Smooth reveal on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.service-card, .why-card, .contact-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

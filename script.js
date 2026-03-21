// ============================================
// KFZ ALTUN — Scripts
// ============================================

// Animated Hero Words
const words = ['Leidenschaft.', 'Präzision.', 'Vertrauen.', 'Familie.', 'Handwerk.', 'Qualität.'];
let currentIndex = 0;
const heroWord = document.getElementById('heroWord');

function cycleWords() {
    if (!heroWord) return;

    heroWord.classList.add('fade-out');

    setTimeout(() => {
        currentIndex = (currentIndex + 1) % words.length;
        heroWord.textContent = words[currentIndex];
        heroWord.classList.remove('fade-out');
        heroWord.classList.add('fade-in');

        setTimeout(() => {
            heroWord.classList.remove('fade-in');
        }, 400);
    }, 400);
}

setInterval(cycleWords, 2500);

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

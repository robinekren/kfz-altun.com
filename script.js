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

// Echte Google-Bewertungen (Places API über /api/reviews) — ohne Daten bleibt alles leer
(function loadGoogleReviews() {
    const box = document.getElementById('googleReviews');
    if (!box || !window.fetch) return;

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function stars(rating) {
        const full = Math.round(rating);
        const s = el('span', 'greview-stars', '★'.repeat(full) + '☆'.repeat(5 - full));
        s.setAttribute('aria-label', rating.toLocaleString('de-AT') + ' von 5 Sternen');
        return s;
    }

    fetch('/api/reviews', { headers: { Accept: 'application/json' } })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
            if (!data || data.configured === false || !data.count || !Array.isArray(data.reviews)) return;
            const reviews = data.reviews.filter(r => r && r.author && r.rating).slice(0, 5);

            const head = el('div', 'greviews-head');
            if (typeof data.rating === 'number') {
                const avg = el('p', 'greviews-avg');
                avg.append(
                    el('strong', null, data.rating.toLocaleString('de-AT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ★'),
                    document.createTextNode(' aus ' + data.count.toLocaleString('de-AT') + ' Google-Bewertung' + (data.count === 1 ? '' : 'en'))
                );
                head.append(avg);
            }
            box.append(head);

            if (reviews.length) {
                const list = el('div', 'greviews-list');
                reviews.forEach(r => {
                    const card = el('article', 'greview');
                    const top = el('div', 'greview-top');
                    const name = r.authorUrl ? el('a', 'greview-author', r.author) : el('span', 'greview-author', r.author);
                    if (r.authorUrl) { name.href = r.authorUrl; name.target = '_blank'; name.rel = 'noopener nofollow'; }
                    top.append(name, stars(r.rating));
                    card.append(top);
                    if (r.text) {
                        const text = el('p', 'greview-text', r.text);
                        card.append(text);
                        requestAnimationFrame(() => {
                            if (text.scrollHeight > text.clientHeight + 2) {
                                const more = el('button', 'greview-more', 'mehr');
                                more.type = 'button';
                                more.addEventListener('click', () => {
                                    const open = text.classList.toggle('open');
                                    more.textContent = open ? 'weniger' : 'mehr';
                                });
                                text.after(more);
                            }
                        });
                    }
                    if (r.relativeTime) card.append(el('span', 'greview-time', r.relativeTime));
                    list.append(card);
                });
                box.append(list);
            }

            const foot = el('div', 'greviews-foot');
            foot.append(el('span', 'greviews-source', 'Bewertungen von Google'));
            if (data.mapsUrl) {
                const all = el('a', 'greviews-all', 'Alle Bewertungen auf Google');
                all.href = data.mapsUrl; all.target = '_blank'; all.rel = 'noopener';
                foot.append(all);
            }
            box.append(foot);
            box.hidden = false;
        })
        .catch(() => {});
})();

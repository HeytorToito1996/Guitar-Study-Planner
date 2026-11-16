/* ===== GUITAR STUDY ROUTER — LANDING PAGE ===== */

(function () {
  'use strict';

  // ── Estado do tema ─────────────────────────────────────────────
  const THEME_KEY = 'gsr-theme';
  const html = document.documentElement;
  const themeToggle = document.querySelector('.theme-toggle');

  function getSavedTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function setTheme(theme) {
    if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else if (theme === 'light') {
      html.removeAttribute('data-theme');
      localStorage.setItem(THEME_KEY, 'light');
    } else {
      // sistema: não seta atributo, segue o color-scheme do navegador
      html.removeAttribute('data-theme');
      localStorage.removeItem(THEME_KEY);
    }
    updateToggleIcon();
  }

  function updateToggleIcon() {
    if (!themeToggle) return;
    const isDark = html.hasAttribute('data-theme') && html.getAttribute('data-theme') === 'dark';
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-pressed', isDark);
  }

  function resolveInitialTheme() {
    const saved = getSavedTheme();
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    } else {
      // segue preferência do sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        html.setAttribute('data-theme', 'dark');
      }
      updateToggleIcon();
    }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = html.hasAttribute('data-theme') && html.getAttribute('data-theme') === 'dark';
      setTheme(isDark ? 'light' : 'dark');
    });
  }

  // ── Navbar: fundo ao rolar ─────────────────────────────────────
  const navbar = document.querySelector('.navbar');
  let ticking = false;

  function updateNavbar() {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateNavbar);
      ticking = true;
    }
  });
  updateNavbar();

  // ── Menu mobile ────────────────────────────────────────────────
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open);
    });

    // Fecha o menu ao clicar num link
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ── Inicialização ──────────────────────────────────────────────
  resolveInitialTheme();
})();

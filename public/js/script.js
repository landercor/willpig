document.addEventListener('DOMContentLoaded', () => {
  // 🌙 Modo oscuro con persistencia
  const themeToggle = document.getElementById('theme-toggle');
  const body = document.body;

  // Cargar preferencia guardada
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      const isDark = body.classList.contains('dark-mode');
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  // ✨ Animaciones Fluídas (Staggered Reveal)
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        // Añadir retraso escalonado si hay varios elementos visibles a la vez
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 100);
        revealObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal-item').forEach(el => revealObserver.observe(el));

  // 🎠 Carrusel Cinematográfico
  const slides = document.querySelectorAll('.slide');
  const prevBtn = document.querySelector('.prev');
  const nextBtn = document.querySelector('.next');
  const indicators = document.querySelectorAll('.indicator');
  let currentSlide = 0;

  function showSlide(index) {
    const totalSlides = slides.length;
    if (!totalSlides) return;

    // Normalize index so it wraps around
    currentSlide = (index + totalSlides) % totalSlides;

    // Update visible slide
    slides.forEach((slide, i) => {
      slide.classList.toggle('active', i === currentSlide);
    });

    // Sync indicators with current slide
    if (indicators.length === totalSlides) {
      indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === currentSlide);
      });
    }
  }

  // Keyboard navigation: ArrowLeft / ArrowRight
  document.addEventListener('keydown', (event) => {
    if (!slides.length) return;

    if (event.key === 'ArrowRight') {
      showSlide(currentSlide + 1);
    } else if (event.key === 'ArrowLeft') {
      showSlide(currentSlide - 1);
    }
  });

  if (slides.length > 0 && prevBtn && nextBtn) {
    showSlide(currentSlide);

    const nextSlide = () => {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
    };

    const prevSlide = () => {
      currentSlide = (currentSlide - 1 + slides.length) % slides.length;
      showSlide(currentSlide);
    };

    nextBtn.addEventListener('click', nextSlide);
    prevBtn.addEventListener('click', prevSlide);

    // Auto-play
    let slideInterval = setInterval(nextSlide, 6000);

    // Pause on hover
    const carouselSection = document.querySelector('.hero-carousel');
    if (carouselSection) {
      carouselSection.addEventListener('mouseenter', () => clearInterval(slideInterval));
      carouselSection.addEventListener('mouseleave', () => slideInterval = setInterval(nextSlide, 6000));
    }
  }

  // Scroll horizontal suavizado
  const scrollWrappers = document.querySelectorAll('.scroll-wrapper');
  scrollWrappers.forEach(wrapper => {
    const container = wrapper.querySelector('.scroll-container');
    const leftBtn = wrapper.querySelector('.scroll-btn.left');
    const rightBtn = wrapper.querySelector('.scroll-btn.right');

    if (container && leftBtn && rightBtn) {
      leftBtn.addEventListener('click', () => {
        container.scrollBy({ left: -400, behavior: 'smooth' });
      });

      rightBtn.addEventListener('click', () => {
        container.scrollBy({ left: 400, behavior: 'smooth' });
      });
    }
  });
});

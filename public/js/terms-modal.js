/**
 * terms-modal.js
 * ──────────────────────────────────────────────────────────────
 * Controlador del modal de Términos y Condiciones.
 * Este script está incluido en partials/footer.ejs y por lo tanto
 * se carga en TODAS las páginas del sitio.
 *
 * Elementos que maneja:
 *   - #open-footer-terms   → Enlace "Términos" en el footer (todas las páginas)
 *   - #open-terms-modal    → Enlace dentro del formulario de registro (register.ejs)
 *   - #close-terms-modal   → Botón "×" dentro del modal para cerrarlo
 *   - #accept-terms-btn    → Botón "Aceptar y cerrar"
 *   - #terminos            → Checkbox de aceptación en register.ejs (opcional)
 *
 * Comportamiento:
 *   1. Al hacer clic en cualquier enlace de apertura, abre el <dialog> con .showModal()
 *   2. El botón "Aceptar y cerrar" cierra el modal y, si existe el checkbox
 *      de términos (solo en register.ejs), lo marca como aceptado automáticamente.
 *   3. Hacer clic fuera del área del modal también lo cierra.
 * ──────────────────────────────────────────────────────────────
 */

document.addEventListener("DOMContentLoaded", function () {
  const termsModal = document.getElementById('terms-modal');
  const openTermsModal = document.getElementById('open-terms-modal');
  const openFooterTerms = document.getElementById('open-footer-terms');
  const closeTermsModal = document.getElementById('close-terms-modal');
  const acceptTermsBtn = document.getElementById('accept-terms-btn');
  const terminosCheckbox = document.getElementById('terminos');

  // Abrir desde el footer (todas las páginas)
  if (openFooterTerms && termsModal) {
    openFooterTerms.addEventListener('click', (e) => {
      e.preventDefault();
      termsModal.showModal();
    });
  }

  // Abrir desde el enlace dentro del formulario de registro
  if (openTermsModal && termsModal) {
    openTermsModal.addEventListener('click', (e) => {
      e.preventDefault();
      termsModal.showModal();
    });
  }

  // Cerrar con el botón "×"
  if (closeTermsModal && termsModal) {
    closeTermsModal.addEventListener('click', () => {
      termsModal.close();
    });
  }

  // Aceptar y cerrar (también marca el checkbox si existe en register.ejs)
  if (acceptTermsBtn && termsModal) {
    acceptTermsBtn.addEventListener('click', () => {
      if (terminosCheckbox) terminosCheckbox.checked = true;
      termsModal.close();
    });
  }

  // Cerrar al hacer clic fuera del área del modal
  if (termsModal) {
    termsModal.addEventListener('click', (e) => {
      const dialogDimensions = termsModal.getBoundingClientRect();
      if (
        e.clientX < dialogDimensions.left ||
        e.clientX > dialogDimensions.right ||
        e.clientY < dialogDimensions.top ||
        e.clientY > dialogDimensions.bottom
      ) {
        termsModal.close();
      }
    });
  }
  // ── Modal: Función no disponible ──────────────────────────
  const comingSoonModal = document.getElementById('coming-soon-modal');
  const openComingSoon = document.getElementById('open-coming-soon');
  const closeComingSoon = document.getElementById('close-coming-soon');

  if (openComingSoon && comingSoonModal) {
    openComingSoon.addEventListener('click', (e) => {
      e.preventDefault();
      comingSoonModal.showModal();
    });
  }

  if (closeComingSoon && comingSoonModal) {
    closeComingSoon.addEventListener('click', () => {
      comingSoonModal.close();
    });
  }

  // Cerrar al hacer clic fuera
  if (comingSoonModal) {
    comingSoonModal.addEventListener('click', (e) => {
      const rect = comingSoonModal.getBoundingClientRect();
      if (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom
      ) {
        comingSoonModal.close();
      }
    });
  }
});

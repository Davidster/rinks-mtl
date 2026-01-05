/**
 * Home page initialization and event handlers.
 */

/**
 * Initializes the language picker links.
 */
function initLanguagePicker(): void {
  const langLinks = document.querySelectorAll<HTMLAnchorElement>(".language-link");
  langLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const newLang = link.getAttribute("data-lang");
      if (!newLang) {
        return;
      }
      const currentQuery = window.location.search;
      const newPath = `/${newLang}`;
      window.location.href = newPath + currentQuery;
    });
  });
}

/**
 * Initializes the intro dismiss functionality (mobile only).
 */
function initIntroDismiss(): void {
  const introClose = document.getElementById("intro-close");
  const introText = document.getElementById("intro-text");
  if (!introClose || !introText) {
    return;
  }

  introClose.addEventListener("click", () => {
    introText.classList.add("dismissed");
  });
}

/**
 * Initializes all home page functionality.
 */
function init(): void {
  initLanguagePicker();
  initIntroDismiss();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

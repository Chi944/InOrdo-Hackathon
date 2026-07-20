"use client";

export function SkipLink() {
  function focusMainContent() {
    const mainContent = document.getElementById("main-content");

    if (!(mainContent instanceof HTMLElement)) {
      return;
    }

    if (!mainContent.hasAttribute("tabindex")) {
      mainContent.setAttribute("tabindex", "-1");
    }

    mainContent.focus();
  }

  return (
    <a className="skip-link" href="#main-content" onClick={focusMainContent}>
      Skip to main content
    </a>
  );
}

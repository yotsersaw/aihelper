"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __selvantoAdminModalCleanup?: () => void;
  }
}

export default function AdminModalInit() {
  useEffect(() => {
    if (window.__selvantoAdminModalCleanup) {
      window.__selvantoAdminModalCleanup();
      window.__selvantoAdminModalCleanup = undefined;
    }

    const getOpenModals = () =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-modal]")).filter(
        (modal) => !modal.classList.contains("hidden")
      );

    const lockBody = () => {
      if (getOpenModals().length > 0) {
        document.body.classList.add("overflow-hidden");
      } else {
        document.body.classList.remove("overflow-hidden");
      }
    };

    const openModal = (id: string) => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.remove("hidden");
      lockBody();
    };

    const closeModal = (modal?: Element | null) => {
      if (!modal || !(modal instanceof HTMLElement)) return;
      modal.classList.add("hidden");
      lockBody();
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const openButton = target.closest("[data-open-modal]");
      if (openButton) {
        event.preventDefault();
        const modalId = openButton.getAttribute("data-open-modal");
        if (modalId) openModal(modalId);
        return;
      }

      const closeButton = target.closest("[data-close-modal]");
      if (closeButton) {
        event.preventDefault();
        closeModal(closeButton.closest("[data-modal]"));
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const openModals = getOpenModals();
      const lastModal = openModals[openModals.length - 1];
      if (lastModal) closeModal(lastModal);
    };

    const handleSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const modal = form.closest("[data-modal]");
      if (!modal) return;
      closeModal(modal);
    };

    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("submit", handleSubmit);

    lockBody();

    const cleanup = () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("submit", handleSubmit);
      document.body.classList.remove("overflow-hidden");
    };

    window.__selvantoAdminModalCleanup = cleanup;

    return cleanup;
  }, []);

  return null;
}

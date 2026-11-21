import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no matchMedia; every query answers false.
window.matchMedia ??= (query: string) =>
  ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

afterEach(() => {
  cleanup();
  // The open panes are remembered in localStorage (SRS-FR-084); one test must not reopen another's.
  localStorage.clear();
});

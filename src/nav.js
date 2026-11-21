import { useEffect } from "react";
import { isPlaying } from "./display.js";
import { sfx } from "./sound.js";
import { selectKey, backKey } from "./keys.js";

// ─── Keyboard navigation for every screen that is not a running game ───
// Arrows move between controls; the solo hard drop key (Space by default) picks
// and the solo counter-clockwise rotation key (Z by default) goes back, same
// as Esc. Enter also picks.
// It works on whatever is on top: an open dropdown, a dialog, a pause or result
// overlay, or a setup page. The home menu has its own keys.
//
// A row of choices (segmented buttons, piece chips) counts as a single stop:
// Left and Right move inside it, Up and Down move on to the next control. In a
// segmented row moving also selects, like a slider. Vertical lists (line
// counts, openers) are plain stops: Space picks the one the keys are on.

const GROUPS = '[role="radiogroup"]:not(.choice-list), .multi';
const FOLLOW = '[role="radiogroup"]'; // moving inside also selects
const QUIET_MS = 600; // after a game key, so mashing at the end of a run picks nothing

let lastGameKeyAt = 0;
let last = null; // last control the keys were on (clicks blur buttons)

function scopeEl() {
  const pick = (sel) => {
    const all = document.querySelectorAll(sel);
    return all[all.length - 1] || null;
  };
  const top = pick(".dd.open .dd-menu") || pick(".dialog") || pick(".veil") || pick(".page");
  // Battle with two players: each seat works its own menu with its own keys.
  return top?.dataset.nav === "off" ? null : top;
}

function stopsIn(root) {
  return [...root.querySelectorAll('button, input[type="range"]')].filter(
    (el) =>
      !el.disabled &&
      el.tabIndex !== -1 &&
      el.getClientRects().length > 0 &&
      !el.closest('[aria-hidden="true"]') &&
      !el.closest(".dd:not(.open) .dd-menu") &&
      getComputedStyle(el).visibility !== "hidden",
  );
}

const isOn = (el) => el.classList.contains("on") || el.getAttribute("aria-checked") === "true";

function press(el) {
  el.click();
  // Click handlers blur the button; put the keys back on it if it is still there.
  if (el.isConnected) el.focus();
}

function go(el) {
  el.focus();
  last = el;
  sfx.tick();
}

export function useKeyNav() {
  useEffect(() => {
    let swallowUp = false;
    const onDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isPlaying()) {
        if (e.code !== "Escape") lastGameKeyAt = performance.now();
        return;
      }
      const t = e.target;
      if (t instanceof HTMLElement && t.closest('input:not([type="range"]), textarea')) return;

      const scope = scopeEl();
      if (!scope) return;
      const quiet = performance.now() - lastGameKeyAt < QUIET_MS;

      if (e.code === backKey()) {
        if (e.repeat || quiet) return;
        e.preventDefault();
        (document.activeElement || document.body).dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }),
        );
        return;
      }

      const stops = stopsIn(scope);
      if (!stops.length) return;
      const active = document.activeElement;
      const cur = stops.includes(active) ? active : stops.includes(last) ? last : null;

      const pick = selectKey();
      if (e.code === pick || e.code === "Enter" || e.code === "NumpadEnter") {
        if (e.repeat) return e.preventDefault();
        if (cur && cur === active) {
          if (cur.tagName === "INPUT") return;
          e.preventDefault();
          swallowUp = e.code === pick;
          return press(cur);
        }
        // Nothing picked yet: the main button of the screen.
        const main = stops.find((el) => el.classList.contains("primary"));
        if (!main || quiet) return;
        e.preventDefault();
        swallowUp = e.code === pick;
        main.click();
        return;
      }

      const dir = { ArrowUp: [-1, "v"], ArrowDown: [1, "v"], ArrowLeft: [-1, "h"], ArrowRight: [1, "h"] }[e.code];
      if (!dir) return;
      const [d, axis] = dir;

      if (!cur) {
        e.preventDefault();
        return go(stops.find((el) => el.classList.contains("primary")) || stops[0]);
      }
      if (cur.tagName === "INPUT" && axis === "h" && cur === active) return; // slider value

      e.preventDefault();
      const groupOf = (el) => {
        const g = el.closest(GROUPS);
        return g && scope.contains(g) ? g : null;
      };
      const group = groupOf(cur);
      if (group && axis === "h") {
        const members = stops.filter((el) => groupOf(el) === group);
        const next = members[members.indexOf(cur) + d];
        if (next) {
          go(next);
          if (group.matches(FOLLOW)) press(next);
        }
        return;
      }
      // Next control: a group is entered at its current choice.
      const units = [];
      for (const el of stops) {
        const g = groupOf(el);
        if (g && units[units.length - 1]?.g === g) units[units.length - 1].els.push(el);
        else units.push({ g, els: [el] });
      }
      const target = units[units.findIndex((u) => u.els.includes(cur)) + d];
      if (!target) return;
      go(target.els.find(isOn) || target.els[0]);
    };
    const onUp = (e) => {
      if (swallowUp) e.preventDefault();
      swallowUp = false;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
}

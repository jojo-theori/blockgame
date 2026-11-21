import { useState, useEffect, useRef, useCallback } from "react";
import { flushSync } from "react-dom";
import { t, setLang } from "./i18n.js";
import { useKeyNav } from "./nav.js";
import { selectKey, keyLabel } from "./keys.js";
import Sprint from "./modes/Sprint.jsx";
import Battle from "./modes/Battle.jsx";
import Opening from "./modes/Opening.jsx";
import Finesse from "./modes/Finesse.jsx";
import Lab from "./modes/Lab.jsx";
import Settings from "./modes/Settings.jsx";
import ComingSoon from "./modes/ComingSoon.jsx";
import { KeyHints, TopBar, FocusWarning } from "./ui.jsx";
import { useFocusWarning } from "./display.js";
import { sfx, setSoundEnabled as setSfxEnabled, setSoundOptions } from "./sound.js";

// ─── SETTINGS PERSISTENCE ───
function loadSettings() {
  try {
    const saved = localStorage.getItem("jbl-settings");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem("jbl-settings", JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

// ─── MODES ───
const MODES = [
  { id: "sprint", label: "Sprint", color: "#41b6e6", desc: "Clear a set number of lines as fast as you can.", ready: true },
  { id: "battle", label: "Battle", color: "#e8505b", desc: "One on one against the CPU or a friend on the same keyboard.", ready: true },
  { id: "opening", label: "Opening", color: "#b14fd0", desc: "Practise openers piece by piece: TKI, PCO, DT Cannon, Albatross.", ready: true, beta: true },
  { id: "finesse", label: "Finesse", color: "#5cc45c", desc: "Place each piece in the fewest key presses.", ready: true, beta: true },
  { id: "lab", label: "Lab", color: "#3fc8b4", desc: "Watch a run again from its log.", ready: true, beta: true },
  { id: "puzzle", label: "Puzzle", color: "#f2913d", desc: "Solve set positions.", ready: false },
  { id: "challenge", label: "Challenge", color: "#f2cb4c", desc: "Daily goals.", ready: false },
];

// Next menu row in direction d, skipping modes that are not ready yet.
function stepReady(i, d) {
  let n = i;
  do n = (n + d + MODES.length) % MODES.length;
  while (!MODES[n].ready && n !== i);
  return n;
}

// ─── APP ───
export default function App() {
  const [view, setView] = useState("menu");

  const [das, setDas] = useState(() => loadSettings().das ?? 133);
  const [arr, setArr] = useState(() => loadSettings().arr ?? 10);
  const [sdf, setSdf] = useState(() => loadSettings().sdf ?? 30);
  const [soundEnabled, setSoundEnabled] = useState(() => loadSettings().soundEnabled ?? true);
  // Sounds that have their own switch: finesse faults, back-to-back, combo.
  const [soundOpts, setSoundOpts] = useState(() => ({ fault: true, b2b: true, combo: true, ...loadSettings().soundOpts }));
  const [showLog, setShowLog] = useState(() => loadSettings().showLog ?? true);
  const [showKeys, setShowKeys] = useState(() => loadSettings().showKeys ?? false);
  const [lang, setLangState] = useState(() => loadSettings().lang ?? (navigator.language?.startsWith("ko") ? "ko" : "en"));
  const [theme, setTheme] = useState(() => loadSettings().theme ?? "dark");
  // Language is read by t() during render, so set it before children render.
  setLang(lang);

  // Settings are a dialog over whatever is on screen, not a view of their own.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const [menuIdx, setMenuIdx] = useState(0);
  const focusLost = useFocusWarning();
  useKeyNav();
  const rowRefs = useRef([]);

  useEffect(() => {
    const prev = loadSettings();
    saveSettings({ ...prev, das, arr, sdf, soundEnabled, soundOpts, showLog, showKeys, lang, theme });
  }, [das, arr, sdf, soundEnabled, soundOpts, showLog, showKeys, lang, theme]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector("meta[name=theme-color]")?.setAttribute("content", theme === "light" ? "#f3f3f1" : "#0a0a0a");
  }, [theme]);

  // The whole page cross-fades between themes (where the browser can), instead
  // of each colour changing on its own.
  const changeTheme = useCallback((next) => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || still) return setTheme(next);
    document.startViewTransition(() => flushSync(() => setTheme(next)));
  }, []);

  // Every sound follows the Sound setting.
  useEffect(() => {
    setSfxEnabled(soundEnabled);
    setSoundOptions(soundOpts);
  }, [soundEnabled, soundOpts]);

  // Keep game keys from scrolling the page
  useEffect(() => {
    const preventScroll = (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        if (e.target === document.body || e.target === document.documentElement) e.preventDefault();
      }
    };
    window.addEventListener("keydown", preventScroll);
    return () => window.removeEventListener("keydown", preventScroll);
  }, []);

  // Keyboard navigation on the index
  useEffect(() => {
    if (view !== "menu" || settingsOpen) return;
    const handleKey = (e) => {
      if (e.code === "ArrowDown" || (e.code === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        setMenuIdx((i) => stepReady(i, 1));
        sfx.tick();
      } else if (e.code === "ArrowUp" || (e.code === "Tab" && e.shiftKey)) {
        e.preventDefault();
        setMenuIdx((i) => stepReady(i, -1));
        sfx.tick();
      } else if (e.code === selectKey() || e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        const item = MODES[menuIdx];
        if (item?.ready) {
          sfx.select();
          setView(item.id);
        }
      } else if (/^Digit[1-9]$/.test(e.code)) {
        const item = MODES[+e.code.slice(5) - 1];
        if (item?.ready) setView(item.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [view, menuIdx, settingsOpen]);

  useEffect(() => {
    if (view !== "menu") return;
    rowRefs.current[menuIdx]?.focus();
  }, [view, menuIdx]);

  const settings = { das, arr, sdf, soundEnabled, showLog, showKeys, setShowLog, setShowKeys, settingsOpen, openSettings };
  const goMenu = () => {
    setSettingsOpen(false);
    setView("menu");
  };
  const current = MODES.find((m) => m.id === view);

  return (
    <div className={"app" + (view === "menu" ? " is-home" : "")}>
      <div className="bg-grid" />
      {view !== "menu" && (
        <button className="wordmark" onClick={goMenu} title={t("Home")}>
          JBL
        </button>
      )}

      <FocusWarning show={focusLost} />
      <TopBar lang={lang} setLang={setLangState} theme={theme} setTheme={changeTheme} onSettings={openSettings} />
      {settingsOpen && (
        <Settings
          das={das}
          setDas={setDas}
          arr={arr}
          setArr={setArr}
          sdf={sdf}
          setSdf={setSdf}
          soundEnabled={soundEnabled}
          soundOpts={soundOpts}
          setSoundOpts={setSoundOpts}
          setSoundEnabled={setSoundEnabled}
          onClose={closeSettings}
        />
      )}

      <main className="main">
        {view === "menu" && (
          <div className="home">
            <h1 className="logo">JBL</h1>
            <div className="sub">Jojo&apos;s Blockgame Laboratory</div>
            <div className="menu">
              {MODES.map((m, i) => (
                <button
                  key={m.id}
                  ref={(el) => (rowRefs.current[i] = el)}
                  className={[menuIdx === i ? "on" : "", m.ready ? "" : "soon"].join(" ")}
                  style={{ "--accent": m.color }}
                  onMouseEnter={() => m.ready && setMenuIdx(i)}
                  disabled={!m.ready}
                  onClick={() => {
                    if (!m.ready) return;
                    sfx.select();
                    setView(m.id);
                  }}
                >
                  <i className="dot" />
                  {t(m.label)}
                  {!m.ready && <span className="tag">{t("Soon")}</span>}
                  {m.beta && <span className="tag">{t("Beta")}</span>}
                </button>
              ))}
            </div>
            <KeyHints items={[[["↑", "↓"], "move"], [[keyLabel(selectKey())], "open"]]} />
          </div>
        )}

        {view === "sprint" && <Sprint settings={settings} onBack={goMenu} />}
        {view === "battle" && <Battle settings={settings} onBack={goMenu} />}
        {view === "opening" && <Opening settings={settings} onBack={goMenu} />}
        {view === "finesse" && <Finesse settings={settings} onBack={goMenu} />}
        {view === "lab" && <Lab settings={settings} onBack={goMenu} />}
        {current && !current.ready && <ComingSoon label={t(current.label)} color={current.color} onBack={goMenu} />}
      </main>

      <footer className="ftr">
        {t("Inspired by")}{" "}
        <a href="https://jstris.jezevec10.com/" target="_blank" rel="noopener noreferrer">
          Jstris
        </a>{" "}
        · {t("Openers after")}{" "}
        <a href="https://four.lol/" target="_blank" rel="noopener noreferrer">
          four.lol
        </a>{" "}
        · {t("Made by")}{" "}
        <a href="https://umjo.me" target="_blank" rel="noopener noreferrer">
          umjo.me
        </a>
      </footer>
    </div>
  );
}

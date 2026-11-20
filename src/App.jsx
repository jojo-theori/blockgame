import { useState, useEffect, useRef } from "react";
import Sprint from "./modes/Sprint.jsx";
import Battle from "./modes/Battle.jsx";
import Opening from "./modes/Opening.jsx";
import Finesse from "./modes/Finesse.jsx";
import Settings from "./modes/Settings.jsx";
import ComingSoon from "./modes/ComingSoon.jsx";
import { KeyHints } from "./ui.jsx";

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
  { id: "opening", label: "Opening", color: "#b14fd0", desc: "Practise openers piece by piece: TKI, PCO, DT Cannon, Albatross.", ready: true },
  { id: "finesse", label: "Finesse", color: "#5cc45c", desc: "Place each piece in the fewest key presses.", ready: true },
  { id: "puzzle", label: "Puzzle", color: "#f2913d", desc: "Solve set positions.", ready: false },
  { id: "challenge", label: "Challenge", color: "#f2cb4c", desc: "Daily goals.", ready: false },
  { id: "settings", label: "Settings", color: "#8a8a8a", desc: "Handling, sound and key bindings.", ready: true },
];

// ─── APP ───
export default function App() {
  const [view, setView] = useState("menu");

  const [das, setDas] = useState(() => loadSettings().das ?? 133);
  const [arr, setArr] = useState(() => loadSettings().arr ?? 10);
  const [sdf, setSdf] = useState(() => loadSettings().sdf ?? 30);
  const [soundEnabled, setSoundEnabled] = useState(() => loadSettings().soundEnabled ?? true);

  const [menuIdx, setMenuIdx] = useState(0);
  const rowRefs = useRef([]);

  useEffect(() => {
    const prev = loadSettings();
    saveSettings({ ...prev, das, arr, sdf, soundEnabled });
  }, [das, arr, sdf, soundEnabled]);

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
    if (view !== "menu") return;
    const handleKey = (e) => {
      if (e.code === "ArrowDown" || (e.code === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        setMenuIdx((i) => (i + 1) % MODES.length);
      } else if (e.code === "ArrowUp" || (e.code === "Tab" && e.shiftKey)) {
        e.preventDefault();
        setMenuIdx((i) => (i - 1 + MODES.length) % MODES.length);
      } else if (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") {
        e.preventDefault();
        const item = MODES[menuIdx];
        if (item?.ready) setView(item.id);
      } else if (/^Digit[1-9]$/.test(e.code)) {
        const item = MODES[+e.code.slice(5) - 1];
        if (item?.ready) setView(item.id);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [view, menuIdx]);

  useEffect(() => {
    if (view !== "menu") return;
    rowRefs.current[menuIdx]?.focus();
  }, [view, menuIdx]);

  const settings = { das, arr, sdf, soundEnabled };
  const goMenu = () => setView("menu");
  const current = MODES.find((m) => m.id === view);

  return (
    <div className="app">
      <div className="bg-grid" />
      {view !== "menu" && (
        <button className="wordmark" onClick={goMenu} title="Home">
          JBL
        </button>
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
                  onMouseEnter={() => setMenuIdx(i)}
                  onClick={() => m.ready && setView(m.id)}
                >
                  <i className="dot" />
                  {m.label}
                  {!m.ready && <span className="tag">Soon</span>}
                </button>
              ))}
            </div>
            <KeyHints items={[[["↑", "↓"], "move"], [["Enter"], "open"]]} />
          </div>
        )}

        {view === "settings" && (
          <Settings
            das={das}
            setDas={setDas}
            arr={arr}
            setArr={setArr}
            sdf={sdf}
            setSdf={setSdf}
            soundEnabled={soundEnabled}
            setSoundEnabled={setSoundEnabled}
            onBack={goMenu}
          />
        )}
        {view === "sprint" && <Sprint settings={settings} onBack={goMenu} />}
        {view === "battle" && <Battle settings={settings} onBack={goMenu} onSettings={() => setView("settings")} />}
        {view === "opening" && <Opening settings={settings} onBack={goMenu} />}
        {view === "finesse" && <Finesse settings={settings} onBack={goMenu} />}
        {current && !current.ready && <ComingSoon label={current.label} color={current.color} onBack={goMenu} />}
      </main>

      <footer className="ftr">
        Inspired by{" "}
        <a href="https://jstris.jezevec10.com/" target="_blank" rel="noopener noreferrer">
          Jstris
        </a>{" "}
        · Openers after{" "}
        <a href="https://four.lol/" target="_blank" rel="noopener noreferrer">
          four.lol
        </a>{" "}
        · Made by{" "}
        <a href="https://umjo.me" target="_blank" rel="noopener noreferrer">
          umjo.me
        </a>
      </footer>
    </div>
  );
}

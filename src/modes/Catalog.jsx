// ─── Components ───
// Every shared part on one page, live, so a new screen can be put together
// from what is here and a change to a part can be seen everywhere at once.
import { useState } from "react";
import { t } from "../i18n.js";
import {
  Segmented,
  Dropdown,
  Switch,
  Checkbox,
  Stepper,
  ConfirmDialog,
  ActionMenu,
  Stat,
  Kbd,
  KeyHints,
  PieceIcon,
  GarbageIcon,
  Swatch,
  Icon,
  ICON_NAMES,
  IconButton,
  Chip,
  ChipGrid,
  Well,
} from "../ui.jsx";

const ACCENT = "#f2cb4c";
const COLOURS = ["--fg", "--dim", "--faint", "--muted", "--line", "--hover", "--fill", "--bad"];
const TYPE = ["--t1", "--t2", "--t3", "--t4", "--t5", "--t6", "--t7"];
const PIECES = [1, 2, 3, 4, 5, 6, 7];

function Row({ name, children }) {
  return (
    <div className="cat-row">
      <div className="k">{t(name)}</div>
      <div className="cat-items">{children}</div>
    </div>
  );
}

export default function Catalog({ onBack }) {
  const [seg, setSeg] = useState("a");
  const [tool, setTool] = useState("pencil");
  const [pick, setPick] = useState("one");
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [n, setN] = useState(0);
  const [chip, setChip] = useState(2);
  const [ask, setAsk] = useState(false);
  return (
    <div className="page wide" style={{ "--accent": ACCENT }}>
      <h1 className="title">{t("Components")}</h1>
      <p className="lede">{t("The parts every screen is built from.")}</p>
      <div className="mid">
        <div className="cat">
          <Row name="Colour">
            {COLOURS.map((c) => (
              <span key={c} className="cat-token">
                <i style={{ background: `var(${c})` }} />
                {c}
              </span>
            ))}
          </Row>
          <Row name="Type">
            {TYPE.map((v) => (
              <span key={v} className="cat-type" style={{ fontSize: `var(${v})` }}>
                Aa 가 <small>{v}</small>
              </span>
            ))}
          </Row>
          <Row name="Button">
            <button className="btn primary">{t("Play")}</button>
            <button className="btn">{t("Save")}</button>
            <button className="btn ghost">{t("Back")}</button>
            <button className="btn danger">{t("Delete")}</button>
            <button className="btn" disabled>
              {t("Save")}
            </button>
          </Row>
          <Row name="Icon button">
            <IconButton icon="back" label="Back" />
            <IconButton icon="more" label="More" filled />
            <IconButton icon="trash" label="Delete" danger />
            <IconButton icon="back" label="Back" size="m" filled />
            <IconButton icon="close" label="Close" disabled />
          </Row>
          <Row name="Icon">
            {ICON_NAMES.map((name) => (
              <span key={name} className="cat-token">
                <Icon name={name} />
                {name}
              </span>
            ))}
          </Row>
          <Row name="Chip">
            <Chip>{t("Sprint")}</Chip>
            <Chip on>{t("Battle")}</Chip>
            <Chip danger title={t("Clear all")}>
              <Icon name="trash" size={15} />
            </Chip>
          </Row>
          <Row name="Chip grid">
            <ChipGrid cols={4} className="cat-fixed">
              {PIECES.map((id) => (
                <Chip key={id} on={chip === id} onClick={() => setChip(id)}>
                  <PieceIcon id={id} />
                </Chip>
              ))}
              <Chip on={chip === 8} onClick={() => setChip(8)}>
                <GarbageIcon size={4} />
              </Chip>
            </ChipGrid>
          </Row>
          <Row name="Segmented">
            <Segmented
              label="Example"
              options={[
                { id: "a", label: "On" },
                { id: "b", label: "Off" },
              ]}
              value={seg}
              onChange={setSeg}
            />
            <Segmented
              label="Tool"
              options={[
                { id: "pencil", title: "Rename", label: <Icon name="pencil" /> },
                { id: "eraser", title: "Erase", label: <Icon name="eraser" /> },
                { id: "eye", title: "Show best", label: <Icon name="eye" /> },
              ]}
              value={tool}
              onChange={setTool}
            />
          </Row>
          <Row name="Dropdown">
            <span className="cat-fixed">
              <Dropdown
                label="Example"
                value={pick}
                options={[
                  { id: "one", label: "Easy" },
                  { id: "two", label: "Normal" },
                  { id: "three", label: "Hard" },
                ]}
                onChange={setPick}
              />
            </span>
            <ActionMenu
              start
              items={[
                { label: "Play", onClick: () => {} },
                { label: "Duplicate", onClick: () => {} },
                { label: "Delete", danger: true, onClick: () => setAsk(true) },
              ]}
            />
          </Row>
          <Row name="Toggle">
            <span className="cat-fixed">
              <Switch checked={on} onChange={setOn} label="Gravity" />
            </span>
            <Checkbox checked={checked} onChange={setChecked} label="Gravity" />
            <Stepper label="Handicap" value={n} onChange={setN} min={-3} max={3} />
          </Row>
          <Row name="Well">
            <Well className="cat-well" hint={t("Click a piece above to add it, and here to take it out.")} />
            <Well className="cat-well">
              <span className="cat-items">
                {PIECES.map((id) => (
                  <PieceIcon key={id} id={id} size={4} />
                ))}
              </span>
            </Well>
          </Row>
          <Row name="In game">
            <Stat k="Lines" v="40" />
            <Stat k="Time" v="0:42.10" big />
            <KeyHints
              items={[
                [["SPACE"], "Play"],
                [["ESC"], "Pause"],
              ]}
            />
            <Kbd>Z</Kbd>
            <Swatch color="#41b6e6" />
          </Row>
        </div>
      </div>
      <ConfirmDialog open={ask} title={t("Delete")} body={t("The parts every screen is built from.")} confirmLabel="Delete" onCancel={() => setAsk(false)} onConfirm={() => setAsk(false)} />
      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          {t("Back")}
        </button>
      </div>
    </div>
  );
}

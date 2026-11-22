// ─── Components ───
// Every shared part on one page, live, so a new screen can be put together
// from what is here and a change to a part can be seen everywhere at once.
import { Fragment, useState } from "react";
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
  Button,
  IconButton,
  HelpTip,
  Chip,
  ChipGrid,
  Well,
} from "../ui.jsx";
import { BUTTON, ICON_BUTTON, CHIP } from "../ui/variants.js";

const ACCENT = "#f2cb4c";
const COLOURS = ["--fg", "--dim", "--faint", "--muted", "--line", "--hover", "--fill", "--bad"];
const TYPE = ["--t1", "--t2", "--t3", "--t4", "--t5", "--t6", "--t7"];
const PIECES = [1, 2, 3, 4, 5, 6, 7];

function Row({ name, stack = false, children }) {
  return (
    <div className="cat-row">
      <div className="k">{t(name)}</div>
      <div className={"cat-items" + (stack ? " stack" : "")}>{children}</div>
    </div>
  );
}

// One part with a control for each of its props: the part itself, the props
// beside it, and the code that makes what is showing.
//   tag       the component's name
//   axes      { prop: [values] } (from variants.js)
//   defaults  the value each prop has when left out (left out of the code too)
//   flags     on/off props
//   fixed     props the example always passes, as written in the code
//   body      what goes between the tags
function Playground({ tag, axes, defaults, flags = [], fixed = "", body, render }) {
  const [v, setV] = useState(() => ({ ...defaults, ...Object.fromEntries(flags.map((f) => [f, false])) }));
  const set = (k) => (x) => setV((o) => ({ ...o, [k]: x }));
  const attrs =
    (fixed && " " + fixed) +
    Object.keys(axes)
      .filter((k) => v[k] !== defaults[k])
      .map((k) => ` ${k}="${v[k]}"`)
      .join("") +
    flags
      .filter((f) => v[f])
      .map((f) => " " + f)
      .join("");
  return (
    <div className="cat-play">
      <div className="cat-stage">{render(v)}</div>
      <div className="cat-knobs">
        {Object.entries(axes).map(([k, values]) => (
          <div key={k} className="cat-knob">
            <span className="k">{k}</span>
            <Segmented label={k} options={values.map((id) => ({ id, label: id }))} value={v[k]} onChange={set(k)} />
          </div>
        ))}
        {flags.map((f) => (
          <div key={f} className="cat-knob">
            <span className="k">{f}</span>
            <Segmented
              label={f}
              options={[
                { id: false, label: "Off" },
                { id: true, label: "On" },
              ]}
              value={v[f]}
              onChange={set(f)}
            />
          </div>
        ))}
      </div>
      <code className="cat-code">{body ? `<${tag}${attrs}>${body}</${tag}>` : `<${tag}${attrs} />`}</code>
    </div>
  );
}

// Every value of one prop against every value of another.
function Matrix({ rows, cols, cell }) {
  return (
    <div className="cat-matrix" style={{ "--cols": cols.length }}>
      <span />
      {cols.map((c) => (
        <span key={c} className="k">
          {c}
        </span>
      ))}
      {rows.map((r) => (
        <Fragment key={r}>
          <span className="k">{r}</span>
          {cols.map((c) => (
            <span key={c}>{cell(r, c)}</span>
          ))}
        </Fragment>
      ))}
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
          <Row name="Button" stack>
            <Playground
              tag="Button"
              axes={BUTTON}
              defaults={{ variant: "secondary", tone: "neutral", size: "m" }}
              flags={["block", "disabled"]}
              body="Save"
              render={(v) => <Button {...v}>{t("Save")}</Button>}
            />
            <Matrix rows={BUTTON.variant} cols={BUTTON.tone} cell={(variant, tone) => <Button variant={variant} tone={tone}>{t("Save")}</Button>} />
            <Matrix rows={["size"]} cols={BUTTON.size} cell={(_, size) => <Button size={size}>{t("Save")}</Button>} />
          </Row>
          <Row name="Icon button" stack>
            <Playground
              tag="IconButton"
              axes={ICON_BUTTON}
              defaults={{ variant: "ghost", tone: "neutral", size: "s" }}
              flags={["disabled"]}
              fixed={'icon="trash" label="Delete"'}
              render={(v) => <IconButton icon="trash" label="Delete" {...v} />}
            />
            <Matrix rows={ICON_BUTTON.variant} cols={ICON_BUTTON.tone} cell={(variant, tone) => <IconButton icon="trash" label="Delete" variant={variant} tone={tone} />} />
            <Matrix rows={["size"]} cols={ICON_BUTTON.size} cell={(_, size) => <IconButton icon="back" label="Back" variant="filled" size={size} />} />
          </Row>
          <Row name="Icon">
            {ICON_NAMES.map((name) => (
              <span key={name} className="cat-token">
                <Icon name={name} />
                {name}
              </span>
            ))}
          </Row>
          <Row name="Chip" stack>
            <Playground tag="Chip" axes={CHIP} defaults={{ tone: "neutral" }} flags={["on", "disabled"]} body="Sprint" render={(v) => <Chip {...v}>{t("Sprint")}</Chip>} />
            <Matrix rows={["off", "on"]} cols={CHIP.tone} cell={(on, tone) => <Chip on={on === "on"} tone={tone}>{t("Sprint")}</Chip>} />
          </Row>
          <Row name="Tip">
            <Chip tip={t("Piece")} keys={["A"]}>
              <PieceIcon id={1} />
            </Chip>
            <HelpTip label="Shortcuts">
              <KeyHints items={[[["Q", "W", "E"], "Piece, cells, erase"]]} />
            </HelpTip>
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

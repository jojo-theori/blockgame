// ─── Components ───
// The design system as a small reference: tokens first, then one page per
// shared part (what it is for, where it lives, its props, a playground and
// examples), so a new screen can be put together from what is here.
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
  Tip,
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
const COLOURS = ["--fg", "--dim", "--faint", "--muted", "--line", "--hover", "--fill", "--bad", "--accent"];
const TYPE = ["--t1", "--t2", "--t3", "--t4", "--t5", "--t6", "--t7"];
const HEIGHTS = ["--h-s", "--h-m"];
const RADII = ["--r-pill", "--r-box", "--r-card"];
const GAPS = ["--gap-s", "--gap-m", "--gap-l"];
const PIECES = [1, 2, 3, 4, 5, 6, 7];

// A labelled example.
function Demo({ label, children }) {
  return (
    <div className="cat-demo">
      <div className="k">{label}</div>
      <div className="cat-items">{children}</div>
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


// ── Pages ──
// Each page: title, source (where it lives), use (what it is for), props
// ([name, values]) and Body (the playground and the examples).
function ChipBody() {
  const [chip, setChip] = useState(2);
  return (
    <>
      <Playground tag="Chip" axes={CHIP} defaults={{ tone: "neutral" }} flags={["on", "disabled"]} body="Sprint" render={(v) => <Chip {...v}>{t("Sprint")}</Chip>} />
      <Demo label="on × tone">
        <Matrix rows={["off", "on"]} cols={CHIP.tone} cell={(on, tone) => <Chip on={on === "on"} tone={tone}>{t("Sprint")}</Chip>} />
      </Demo>
      <Demo label="ChipGrid cols={4}">
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
      </Demo>
    </>
  );
}
function SegmentedBody() {
  const [seg, setSeg] = useState("a");
  const [tool, setTool] = useState("pencil");
  return (
    <>
      <Demo label="label">
        <Segmented
          label="Example"
          options={[
            { id: "a", label: "On" },
            { id: "b", label: "Off" },
          ]}
          value={seg}
          onChange={setSeg}
        />
      </Demo>
      <Demo label="icon + title + keys">
        <Segmented
          label="Tool"
          options={[
            { id: "pencil", title: "Rename", keys: ["Q"], label: <Icon name="pencil" /> },
            { id: "eraser", title: "Erase", keys: ["W"], label: <Icon name="eraser" /> },
            { id: "eye", title: "Show best", keys: ["E"], label: <Icon name="eye" /> },
          ]}
          value={tool}
          onChange={setTool}
        />
      </Demo>
    </>
  );
}
function DropdownBody() {
  const [pick, setPick] = useState("one");
  return (
    <Demo label="default">
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
    </Demo>
  );
}
function ToggleBody({ kind }) {
  const [on, setOn] = useState(true);
  const [n, setN] = useState(0);
  return (
    <Demo label="default">
      {kind === "switch" && (
        <span className="cat-fixed">
          <Switch checked={on} onChange={setOn} label="Gravity" />
        </span>
      )}
      {kind === "checkbox" && <Checkbox checked={on} onChange={setOn} label="Gravity" />}
      {kind === "stepper" && <Stepper label="Handicap" value={n} onChange={setN} min={-3} max={3} />}
    </Demo>
  );
}
function ConfirmBody() {
  const [ask, setAsk] = useState(false);
  return (
    <Demo label="default">
      <Button tone="danger" onClick={() => setAsk(true)}>
        {t("Delete")}
      </Button>
      <ConfirmDialog open={ask} title={t("Delete")} body={t("The parts every screen is built from.")} confirmLabel="Delete" onCancel={() => setAsk(false)} onConfirm={() => setAsk(false)} />
    </Demo>
  );
}

const PAGES = {
  colour: {
    title: "Colour",
    source: "styles/base.css",
    use: "Colours come from these variables; both themes define them.",
    Body: () => (
      <Demo label="var(--…)">
        {COLOURS.map((c) => (
          <span key={c} className="cat-token">
            <i style={{ background: `var(${c})` }} />
            {c}
          </span>
        ))}
      </Demo>
    ),
  },
  type: {
    title: "Type",
    source: "styles/base.css",
    use: "Seven sizes, smallest to largest.",
    Body: () => (
      <Demo label="font-size">
        {TYPE.map((v) => (
          <span key={v} className="cat-type" style={{ fontSize: `var(${v})` }}>
            Aa 가 <small>{v}</small>
          </span>
        ))}
      </Demo>
    ),
  },
  scale: {
    title: "Scale",
    source: "styles/system.css",
    use: "Control heights, corners and the space between things.",
    Body: () => (
      <>
        <Demo label="height">
          {HEIGHTS.map((v) => (
            <span key={v} className="cat-token">
              <i className="cat-bar" style={{ height: `var(${v})` }} />
              {v}
            </span>
          ))}
        </Demo>
        <Demo label="radius">
          {RADII.map((v) => (
            <span key={v} className="cat-token">
              <i className="cat-corner" style={{ borderRadius: `var(${v})` }} />
              {v}
            </span>
          ))}
        </Demo>
        <Demo label="gap">
          {GAPS.map((v) => (
            <span key={v} className="cat-token">
              <span className="cat-gap" style={{ gap: `var(${v})` }}>
                <i />
                <i />
              </span>
              {v}
            </span>
          ))}
        </Demo>
      </>
    ),
  },
  button: {
    title: "Button",
    source: "ui/primitives.jsx",
    use: "A button with a word on it. One primary per screen.",
    props: [
      ["variant", BUTTON.variant.join(" · ") + " (secondary)"],
      ["tone", BUTTON.tone.join(" · ") + " (neutral)"],
      ["size", "s 34px · m 38px · l 40px (m)"],
      ["block", "boolean"],
      ["icon", "Icon name"],
    ],
    Body: () => (
      <>
        <Playground tag="Button" axes={BUTTON} defaults={{ variant: "secondary", tone: "neutral", size: "m" }} flags={["block", "disabled"]} body="Save" render={(v) => <Button {...v}>{t("Save")}</Button>} />
        <Demo label="variant × tone">
          <Matrix rows={BUTTON.variant} cols={BUTTON.tone} cell={(variant, tone) => <Button variant={variant} tone={tone}>{t("Save")}</Button>} />
        </Demo>
        <Demo label="variant × size">
          <Matrix rows={BUTTON.variant} cols={BUTTON.size} cell={(variant, size) => <Button variant={variant} size={size}>{t("Save")}</Button>} />
        </Demo>
        <Demo label="variant × state">
          <Matrix
            rows={BUTTON.variant}
            cols={["default", "disabled", "icon"]}
            cell={(variant, state) => (
              <Button variant={variant} disabled={state === "disabled"} icon={state === "icon" ? "check" : undefined}>
                {t("Save")}
              </Button>
            )}
          />
        </Demo>
      </>
    ),
  },
  iconButton: {
    title: "IconButton",
    source: "ui/primitives.jsx",
    use: "A round button holding one icon. label names it.",
    props: [
      ["icon", "Icon name"],
      ["label", "string (tooltip, screen reader)"],
      ["variant", ICON_BUTTON.variant.join(" · ") + " (ghost)"],
      ["tone", ICON_BUTTON.tone.join(" · ") + " (neutral)"],
      ["size", "s 32px · m 40px (s)"],
    ],
    Body: () => (
      <>
        <Playground tag="IconButton" axes={ICON_BUTTON} defaults={{ variant: "ghost", tone: "neutral", size: "s" }} flags={["disabled"]} fixed={'icon="trash" label="Delete"'} render={(v) => <IconButton icon="trash" label="Delete" {...v} />} />
        <Demo label="variant × tone">
          <Matrix rows={ICON_BUTTON.variant} cols={ICON_BUTTON.tone} cell={(variant, tone) => <IconButton icon="trash" label="Delete" variant={variant} tone={tone} />} />
        </Demo>
        <Demo label="variant × size">
          <Matrix rows={ICON_BUTTON.variant} cols={ICON_BUTTON.size} cell={(variant, size) => <IconButton icon="back" label="Back" variant={variant} size={size} />} />
        </Demo>
      </>
    ),
  },
  actionMenu: {
    title: "ActionMenu",
    source: "ui/overlays.jsx",
    use: "The less common actions of a thing, behind an ellipsis.",
    props: [
      ["items", "[{ label, onClick, danger }]"],
      ["up · start", "boolean: which way it opens"],
      ["size · variant", "as IconButton"],
    ],
    Body: () => (
      <Demo label="start">
        <ActionMenu
          start
          items={[
            { label: "Play", onClick: () => {} },
            { label: "Duplicate", onClick: () => {} },
            { label: "Delete", danger: true, onClick: () => {} },
          ]}
        />
      </Demo>
    ),
  },
  chip: {
    title: "Chip",
    source: "ui/primitives.jsx",
    use: "A pill that can be chosen. ChipGrid lines several up.",
    props: [
      ["on", "boolean"],
      ["tone", CHIP.tone.join(" · ") + " (neutral)"],
      ["tip · keys", "hover note: its name and the keys that pick it"],
      ["ChipGrid cols", "number (4)"],
    ],
    Body: ChipBody,
  },
  segmented: {
    title: "Segmented",
    source: "ui/controls.jsx",
    use: "One of a few, all in view.",
    props: [
      ["options", "[{ id, label, title, keys }]"],
      ["value · onChange", "the chosen id"],
      ["label", "string (screen reader)"],
    ],
    Body: SegmentedBody,
  },
  dropdown: {
    title: "Dropdown",
    source: "ui/controls.jsx",
    use: "One of many, folded away.",
    props: [
      ["options", "[{ id, label }]"],
      ["value · onChange", "the chosen id"],
      ["label", "string"],
    ],
    Body: DropdownBody,
  },
  switch: {
    title: "Switch",
    source: "ui/controls.jsx",
    use: "A setting that is on or off, in a settings row.",
    props: [
      ["checked · onChange", "boolean"],
      ["label · hint", "string"],
    ],
    Body: () => <ToggleBody kind="switch" />,
  },
  checkbox: {
    title: "Checkbox",
    source: "ui/controls.jsx",
    use: "An option that is on or off, beside other controls.",
    props: [
      ["checked · onChange", "boolean"],
      ["label", "string"],
    ],
    Body: () => <ToggleBody kind="checkbox" />,
  },
  stepper: {
    title: "Stepper",
    source: "ui/controls.jsx",
    use: "A small number, a step at a time.",
    props: [
      ["value · onChange", "number"],
      ["min · max", "number"],
      ["label · format", "string · (value) => string"],
    ],
    Body: () => <ToggleBody kind="stepper" />,
  },
  icon: {
    title: "Icon",
    source: "ui/icons.jsx · ui/iconPaths.jsx",
    use: "A line icon by name. New ones go in iconPaths.jsx.",
    props: [
      ["name", "one of the names below"],
      ["size", "number (16)"],
    ],
    Body: () => (
      <Demo label="name">
        {ICON_NAMES.map((name) => (
          <span key={name} className="cat-token">
            <Icon name={name} />
            {name}
          </span>
        ))}
      </Demo>
    ),
  },
  well: {
    title: "Well",
    source: "ui/primitives.jsx",
    use: "A soft box that holds things; hint is what it says while empty.",
    props: [["hint", "string"]],
    Body: () => (
      <>
        <Demo label="hint">
          <Well className="cat-well" hint={t("Click a piece above to add it, and here to take it out.")} />
        </Demo>
        <Demo label="children">
          <Well className="cat-well">
            <span className="cat-items">
              {PIECES.map((id) => (
                <PieceIcon key={id} id={id} size={4} />
              ))}
            </span>
          </Well>
        </Demo>
      </>
    ),
  },
  tip: {
    title: "Tip",
    source: "ui/primitives.jsx",
    use: "What a control is and the keys that reach it, on hover. HelpTip is a question mark with a longer note.",
    props: [
      ["Tip label · keys", "string · [key caps]"],
      ["HelpTip label", "string (screen reader)"],
      ["HelpTip align", "end · start (end)"],
    ],
    Body: () => (
      <>
        <Demo label="Chip tip + keys">
          <Chip tip={t("Piece")} keys={["A"]}>
            <PieceIcon id={1} />
          </Chip>
        </Demo>
        <Demo label="Tip">
          <span className="has-tip cat-tip-host">
            {t("Hold")}
            <Tip label={t("Next piece")} keys={["H"]} />
          </span>
        </Demo>
        <Demo label='HelpTip align="start"'>
          <HelpTip label="Shortcuts" align="start">
            <KeyHints items={[[["Q", "W", "E"], "Piece, cells, erase"]]} />
          </HelpTip>
        </Demo>
      </>
    ),
  },
  kbd: {
    title: "Kbd",
    source: "ui/keys.jsx",
    use: "A key cap. KeyHints pairs caps with what they do.",
    props: [["KeyHints items", "[[[caps], text, on]]"]],
    Body: () => (
      <>
        <Demo label="Kbd">
          <Kbd>Z</Kbd>
          <Kbd>SPACE</Kbd>
        </Demo>
        <Demo label="KeyHints">
          <KeyHints
            items={[
              [["SPACE"], "Play"],
              [["ESC"], "Pause"],
            ]}
          />
        </Demo>
      </>
    ),
  },
  stat: {
    title: "Stat",
    source: "ui/game.jsx",
    use: "A number beside the board, under its label.",
    props: [
      ["k · v", "label · value"],
      ["big", "boolean"],
    ],
    Body: () => (
      <Demo label="default · big">
        <Stat k="Lines" v="40" />
        <Stat k="Time" v="0:42.10" big />
      </Demo>
    ),
  },
  pieceIcon: {
    title: "PieceIcon",
    source: "ui/pieces.jsx",
    use: "A piece, a garbage row or a colour, drawn small.",
    props: [
      ["PieceIcon id · size · rot", "1–7 · cell px (5) · quarter turns"],
      ["GarbageIcon size", "cell px (5)"],
      ["Swatch color · size", "css colour · px (10)"],
    ],
    Body: () => (
      <>
        <Demo label="PieceIcon">
          {PIECES.map((id) => (
            <PieceIcon key={id} id={id} />
          ))}
        </Demo>
        <Demo label="rot">
          {[0, 1, 2, 3].map((rot) => (
            <PieceIcon key={rot} id={3} rot={rot} />
          ))}
        </Demo>
        <Demo label="GarbageIcon · Swatch">
          <GarbageIcon size={4} />
          <Swatch color="#41b6e6" />
        </Demo>
      </>
    ),
  },
  confirmDialog: {
    title: "ConfirmDialog",
    source: "ui/overlays.jsx",
    use: "Asks before something that cannot be taken back.",
    props: [
      ["open", "boolean"],
      ["title · body · confirmLabel", "string"],
      ["onConfirm · onCancel", "function"],
    ],
    Body: ConfirmBody,
  },
};

const SECTIONS = [
  ["Tokens", ["colour", "type", "scale"]],
  ["Actions", ["button", "iconButton", "actionMenu"]],
  ["Choosing", ["chip", "segmented", "dropdown", "switch", "checkbox", "stepper"]],
  ["Display", ["icon", "well", "tip", "kbd", "stat", "pieceIcon"]],
  ["Overlays", ["confirmDialog"]],
];

export default function Catalog({ onBack }) {
  const [at, setAt] = useState("button");
  const page = PAGES[at];
  const { Body } = page;
  return (
    <div className="page wide" style={{ "--accent": ACCENT }}>
      <h1 className="title">{t("Components")}</h1>
      <p className="lede">{t("The parts every screen is built from.")}</p>
      <div className="mid">
        <div className="cat">
          <nav className="cat-nav">
            {SECTIONS.map(([title, ids]) => (
              <div key={title}>
                <div className="k">{t(title)}</div>
                {ids.map((id) => (
                  <button key={id} type="button" className={id === at ? "on" : ""} onClick={() => setAt(id)}>
                    {PAGES[id].title}
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <article className="cat-doc" key={at}>
            <header>
              <h2>{page.title}</h2>
              <p>{t(page.use)}</p>
              <small>src/{page.source}</small>
            </header>
            {page.props && (
              <section>
                <div className="k">{t("Props")}</div>
                <dl className="cat-props">
                  {page.props.map(([name, values]) => (
                    <Fragment key={name}>
                      <dt>{name}</dt>
                      <dd>{values}</dd>
                    </Fragment>
                  ))}
                </dl>
              </section>
            )}
            <Body />
          </article>
        </div>
      </div>
      <div className="actions">
        <button className="btn ghost" onClick={onBack}>
          {t("Back")}
        </button>
      </div>
    </div>
  );
}

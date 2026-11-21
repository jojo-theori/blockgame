// JBL wrapper for Cold Clear (https://github.com/MinusKelvin/cold-clear, MPL-2.0).
// One synchronous call per piece: build the board, think for a node budget,
// return the move as a short string. Runs inside a Web Worker in JBL.
use cold_clear::evaluation::{Evaluator, Standard};
use cold_clear::{BotState, Options};
use libtetris::*;
use std::sync::Mutex;
use wasm_bindgen::prelude::*;

/// Weights for a 40-line Sprint, where only the line count matters: clear in
/// quads and never in ones and twos; T-spins, back-to-back and combos earn
/// nothing; the well sits on an edge. Tried on five seeds, this clears 40
/// lines in ten quads and 101 to 103 pieces (100 is the least possible).
fn sprint_weights() -> Standard {
    let mut w = Standard::default();
    w.clear1 = -300;
    w.clear2 = -250;
    w.clear3 = -150;
    w.clear4 = 600;
    w.well_column = [60, 0, -20, -20, -20, -20, -20, -20, 0, 60];
    w.back_to_back = 0;
    w.b2b_clear = 0;
    w.tslot = [0, 0, 0, 0];
    w.wasted_t = 0;
    w.tspin1 = w.clear1;
    w.tspin2 = w.clear2;
    w.tspin3 = w.clear3;
    w.mini_tspin1 = w.clear1;
    w.mini_tspin2 = w.clear2;
    w.perfect_clear = 0;
    w.combo_garbage = 0;
    w.timed_jeopardy = false;
    w
}
fn weights(sprint: bool) -> Standard {
    if sprint {
        sprint_weights()
    } else {
        Standard::default()
    }
}

fn piece(c: char) -> Option<Piece> {
    Some(match c {
        'I' => Piece::I,
        'T' => Piece::T,
        'L' => Piece::L,
        'J' => Piece::J,
        'S' => Piece::S,
        'Z' => Piece::Z,
        'O' => Piece::O,
        _ => return None,
    })
}

/// field: 400 chars '0'/'1', 40 rows from the BOTTOM up, 10 columns each.
/// queue: current piece first, then the next pieces. hold: letter or ' '.
/// sprint: play for line count alone (see sprint_weights), not for attack.
/// Returns "h" if it holds first, then inputs: l r c (cw) z (ccw) D (sonic drop),
/// then "|x,y,r" for the expected location (debug). Empty string if dead.
#[wasm_bindgen]
pub fn cc_move(field: &str, queue: &str, hold: &str, b2b: bool, combo: u32, incoming: u32, nodes: u32, use_hold: bool, sprint: bool) -> String {
    let mut f = [[false; 10]; 40];
    for (i, ch) in field.chars().enumerate().take(400) {
        f[i / 10][i % 10] = ch == '1';
    }
    let mut board: Board = Board::new_with_state(f, enumset::EnumSet::all(), hold.chars().next().and_then(piece), b2b, combo);
    for c in queue.chars() {
        if let Some(p) = piece(c) {
            board.add_next_piece(p);
        }
    }
    let mut options = Options::default();
    options.use_hold = use_hold;
    options.speculate = true;
    options.min_nodes = nodes;
    options.max_nodes = nodes.max(1) * 2;
    options.threads = 1;
    let eval = weights(sprint);
    let mut bot: BotState<Standard> = BotState::new(board, options);
    let mut guard = 0u32;
    while !bot.min_thinking_reached() && guard < nodes * 4 + 200 {
        guard += 1;
        match bot.think() {
            Ok(thinker) => {
                let r = thinker.think(&eval);
                bot.finish_thinking(r);
            }
            Err(_) => break,
        }
        if bot.is_dead() {
            return String::new();
        }
    }
    match bot.suggest_move(&eval, None, incoming) {
        Some((mv, _)) => {
            let mut s = String::new();
            if mv.hold {
                s.push('h');
            }
            for i in mv.inputs.iter() {
                s.push(match i {
                    PieceMovement::Left => 'l',
                    PieceMovement::Right => 'r',
                    PieceMovement::Cw => 'c',
                    PieceMovement::Ccw => 'z',
                    PieceMovement::SonicDrop => 'D',
                });
            }
            let loc = mv.expected_location;
            s.push_str(&format!("|{},{},{:?},{:?}", loc.x, loc.y, loc.kind.1, loc.tspin));
            s
        }
        None => String::new(),
    }
}

/// Standard, plus a look at every move it chose between: Cold Clear hands the
/// evaluator all the candidates when it picks one, and this keeps a copy.
struct Watching {
    inner: Standard,
    seen: Mutex<Vec<String>>,
}

/// The two numbers out of `Value { value: 1, spike: 2 }` (the fields are private).
fn numbers(debug: &str) -> (i32, i32) {
    let mut found = debug
        .split(|c: char| !(c.is_ascii_digit() || c == '-'))
        .filter_map(|t| t.parse::<i32>().ok());
    (found.next().unwrap_or(0), found.next().unwrap_or(0))
}

impl Evaluator for Watching {
    type Value = <Standard as Evaluator>::Value;
    type Reward = <Standard as Evaluator>::Reward;

    fn name(&self) -> String {
        self.inner.name()
    }

    fn evaluate(&self, lock: &LockResult, board: &Board, move_time: u32, placed: Piece) -> (Self::Value, Self::Reward) {
        self.inner.evaluate(lock, board, move_time, placed)
    }

    fn pick_move(&self, candidates: Vec<cold_clear::MoveCandidate<Self::Value>>, incoming: u32) -> cold_clear::MoveCandidate<Self::Value> {
        let mut seen = self.seen.lock().unwrap();
        seen.clear();
        for c in candidates.iter() {
            let (value, spike) = numbers(&format!("{:?}", c.evaluation));
            let cells: Vec<String> = c.mv.cells().iter().map(|(x, y)| format!("{},{}", x, y)).collect();
            seen.push(format!(
                "{}|{:?}|{}|{}|{}|{}|{}|{:?}",
                if c.hold { "h" } else { "" },
                c.mv.kind.0,
                cells.join(";"),
                value,
                spike,
                c.lock.cleared_lines.len(),
                c.lock.garbage_sent,
                c.mv.tspin
            ));
        }
        drop(seen);
        self.inner.pick_move(candidates, incoming)
    }
}

/// Like cc_move, for analysis: every move Cold Clear weighed at this position,
/// one per line, as
///   hold|piece|x,y;x,y;x,y;x,y|value|spike|lines|attack|tspin
/// (cells count rows from the bottom, 0 first). Before them come the move it
/// would play, prefixed "best ", and the line it expects after it, one move
/// per line prefixed "plan ". Empty string if dead.
#[wasm_bindgen]
pub fn cc_eval(field: &str, queue: &str, hold: &str, b2b: bool, combo: u32, incoming: u32, nodes: u32, use_hold: bool, sprint: bool) -> String {
    let mut f = [[false; 10]; 40];
    for (i, ch) in field.chars().enumerate().take(400) {
        f[i / 10][i % 10] = ch == '1';
    }
    let mut board: Board = Board::new_with_state(f, enumset::EnumSet::all(), hold.chars().next().and_then(piece), b2b, combo);
    for c in queue.chars() {
        if let Some(p) = piece(c) {
            board.add_next_piece(p);
        }
    }
    let mut options = Options::default();
    options.use_hold = use_hold;
    options.speculate = true;
    options.min_nodes = nodes;
    options.max_nodes = nodes.max(1) * 2;
    options.threads = 1;
    let eval = Watching { inner: weights(sprint), seen: Mutex::new(Vec::new()) };
    let mut bot: BotState<Watching> = BotState::new(board, options);
    let mut guard = 0u32;
    while !bot.min_thinking_reached() && guard < nodes * 4 + 200 {
        guard += 1;
        match bot.think() {
            Ok(thinker) => {
                let r = thinker.think(&eval);
                bot.finish_thinking(r);
            }
            Err(_) => break,
        }
        if bot.is_dead() {
            return String::new();
        }
    }
    match bot.suggest_move(&eval, None, incoming) {
        Some((mv, info)) => {
            let cells: Vec<String> = mv.expected_location.cells().iter().map(|(x, y)| format!("{},{}", x, y)).collect();
            let mut out = format!("best {}|{:?}|{}\n", if mv.hold { "h" } else { "" }, mv.expected_location.kind.0, cells.join(";"));
            // The line it expects to follow, a move per line, each on the board the one before left.
            for (p, lock) in info.plan().iter().take(6) {
                let cells: Vec<String> = p.cells().iter().map(|(x, y)| format!("{},{}", x, y)).collect();
                out.push_str(&format!("plan {:?}|{}|{}\n", p.kind.0, cells.join(";"), lock.cleared_lines.len()));
            }
            out.push_str(&eval.seen.lock().unwrap().join("\n"));
            out
        }
        None => String::new(),
    }
}

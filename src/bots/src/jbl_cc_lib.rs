// JBL wrapper for Cold Clear (https://github.com/MinusKelvin/cold-clear, MPL-2.0).
// One synchronous call per piece: build the board, think for a node budget,
// return the move as a short string. Runs inside a Web Worker in JBL.
use cold_clear::evaluation::Standard;
use cold_clear::{BotState, Options};
use libtetris::*;
use wasm_bindgen::prelude::*;

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
/// Returns "h" if it holds first, then inputs: l r c (cw) z (ccw) D (sonic drop),
/// then "|x,y,r" for the expected location (debug). Empty string if dead.
#[wasm_bindgen]
pub fn cc_move(field: &str, queue: &str, hold: &str, b2b: bool, combo: u32, incoming: u32, nodes: u32, use_hold: bool) -> String {
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
    let eval = Standard::default();
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

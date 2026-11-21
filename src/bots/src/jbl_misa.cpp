// JBL wrapper around MisaMinoBot (jezevec10/MisaMinoBot, after misakamm/MisaMino).
// One call per piece: give the board, current piece and queue; get back the
// move string. Hold is passed in on every call.
#define private public
#include "Bot.h"
#undef private
#include <string>
#include <cstring>

static Bot* bot = nullptr;
static std::string out;

extern "C" {

// level 0..10, style 1..5 (1 T-spin+, 2 T-spin, 3 ren, 4 no hold, 5 downstack)
void misa_init(int level, int style) {
    if (!bot) bot = new Bot();
    bot->tetris.reset(0);
    bot->ai.level = level;
    bot->ai.style = style;
    bot->setup();
    AI::setSpin180(false);  // JBL 180 kicks differ; keep to cw/ccw
    bot->m_upcomeAtt = 0;
}

// field: 200 chars of '0'/'2' (20 rows, top to bottom, 10 columns each).
// cur: current piece letter. next: up to 5 letters. Returns moves using
// l r L R (LL/RR = to the wall) d D z c x (ccw, cw, 180) v (hold) V (drop).
const char* misa_move(const char* field, char cur, char hold, const char* next, int combo, int b2b, int incoming) {
    if (!bot) misa_init(4, 2);
    std::string f;
    for (int i = 0; i < 200; i++) { f += field[i]; f += (i % 10 == 9) ? ';' : ','; }
    bot->updateField(f);
    bot->tetris.m_state = AI::Tetris::STATE_READY;
    bot->tetris.m_next[0] = AI::getGem(bot->m_gemMap[cur], 0);
    std::string q;
    for (size_t i = 0; i < strlen(next) && i < 5; i++) { if (i) q += ','; q += next[i]; }
    bot->updateQueue(q);
    bot->tetris.m_pool.combo = combo;
    bot->tetris.m_pool.b2b = b2b;
    // Hold comes from the game each time, so the bot never drifts out of step.
    bot->tetris.m_pool.m_hold = bot->m_gemMap[hold == 0 ? ' ' : hold];
    bot->m_upcomeAtt = incoming;

    std::vector<AI::Gem> nx;
    for (int j = 0; j < 5; ++j) nx.push_back(bot->tetris.m_next[j]);
    AI::RunAI(bot->tetris.ai_movs, bot->tetris.ai_movs_flag, bot->tetris.m_ai_param, bot->tetris.m_pool,
              bot->tetris.m_hold, bot->tetris.m_cur, bot->tetris.m_cur_x, bot->tetris.m_cur_y, nx,
              bot->tetris.hold, bot->m_upcomeAtt, AI_TRAINING_DEEP, bot->tetris.ai_last_deep, bot->ai.level, 0);

    out.clear();
    for (int m : bot->tetris.ai_movs.movs) {
        switch (m) {
            // MisaMino stores column 0 in the high bit, so its world is a mirror
            // of the screen: its "left" is our right and its spins swap too.
            case AI::Moving::MOV_L: out += 'r'; break;
            case AI::Moving::MOV_R: out += 'l'; break;
            case AI::Moving::MOV_LL: out += 'R'; break;
            case AI::Moving::MOV_RR: out += 'L'; break;
            case AI::Moving::MOV_D: out += 'd'; break;
            case AI::Moving::MOV_DD: out += 'D'; break;
            case AI::Moving::MOV_LSPIN: out += 'c'; break;
            case AI::Moving::MOV_RSPIN: out += 'z'; break;
            case AI::Moving::MOV_SPIN2: out += 'x'; break;
            case AI::Moving::MOV_HOLD: out += 'v'; break;
            case AI::Moving::MOV_DROP: out += 'V'; break;
            default: break;
        }
    }
    if (!bot->tetris.alive()) out = "";
    return out.c_str();
}

}

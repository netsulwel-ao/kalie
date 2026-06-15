import { useReducer, useCallback, useRef, useEffect } from 'react';
import {
  createInitialPlayers,
  createInitialOutAreaPos,
  getNoFromValue,
  getColorFromValue,
  getPlayerName,
  checkOutAreaEnd,
  checkPrivateAreaEnd,
  addToArea,
  removeFromArea,
  addToPos,
  removeFromPos,
  SAFE_SQUARES,
} from './gameLogic';

export const PHASE = {
  HOME:          'HOME',
  WAITING_ROLL:  'WAITING_ROLL',
  ROLLING:       'ROLLING',
  CHOOSING_PAWN: 'CHOOSING_PAWN',
  MOVING:        'MOVING',
};

// ── Estado inicial ────────────────────────────────────────────────────────────
function initialState() {
  return {
    phase: PHASE.HOME,
    noOfPlayers: 4,
    playerNo: 1,
    playerName: 'rPlayer',
    diceValue: null,      // 0-5 (face = diceValue+1)
    diceRolling: false,
    diceVisible: false,   // mostra o dado parado após rolar
    countSix: 0,
    preDicePlayerNo: null,
    cut: false,
    pass: false,
    players: createInitialPlayers(),
    outAreaPos: createInitialOutAreaPos(),
    winningOrder: [],
    winBadges: {},
    soundOn: true,
    glowPawns: [],
    // animação de movimento
    movingPawn: null,     // cls da peça em movimento
    movingPath: [],       // sequência de cellIds pelo qual a peça passa
    movingStep: 0,        // passo atual da animação
    // conteúdo das células (derivado)
    cellContents: {},
    privateCellContents: {},
    winCellContents: {},
    inAreaContents: {},
    alertVisible: false,
  };
}

// ── Derivar conteúdo das células ──────────────────────────────────────────────
function buildCellContents(outAreaPos) {
  const cells = {};
  for (let i = 1; i <= 52; i++) {
    if (outAreaPos[i]?.length > 0) cells['out' + i] = [...outAreaPos[i]];
  }
  return cells;
}

function buildPrivateCellContents(players) {
  const cells = {};
  for (const pName in players) {
    const color = pName.charAt(0);
    for (let i = 1; i <= 5; i++) {
      const pos = players[pName].privateAreaPos[i];
      if (pos?.length > 0) cells[color + '-out-' + i] = [...pos];
    }
  }
  return cells;
}

function buildWinCellContents(players) {
  const cells = {};
  for (const pName in players) {
    const color = pName.charAt(0);
    if (players[pName].winArea.length > 0) cells[color] = [...players[pName].winArea];
  }
  return cells;
}

function buildInAreaContents(players) {
  const contents = {};
  for (const pName in players) {
    const color = pName.charAt(0);
    for (let i = 1; i <= 4; i++) {
      contents[color + '-' + i] = players[pName].inArea.includes(color + '-pawn' + i);
    }
  }
  return contents;
}

function syncDerived(state) {
  return {
    ...state,
    cellContents:        buildCellContents(state.outAreaPos),
    privateCellContents: buildPrivateCellContents(state.players),
    winCellContents:     buildWinCellContents(state.players),
    inAreaContents:      buildInAreaContents(state.players),
  };
}

// ── Reducer ───────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'SET_NO_OF_PLAYERS':
      return { ...state, noOfPlayers: action.payload };

    case 'START_GAME': {
      const { noOfPlayers } = state;
      const colors = noOfPlayers === 2 ? ['r','y'] : noOfPlayers === 3 ? ['r','g','y'] : ['r','g','y','b'];
      let players = createInitialPlayers();
      for (const c of colors) {
        const pName = c + 'Player';
        players[pName] = { ...players[pName], inArea: [c+'-pawn1',c+'-pawn2',c+'-pawn3',c+'-pawn4'] };
      }
      return syncDerived({
        ...initialState(), noOfPlayers, players,
        phase: PHASE.WAITING_ROLL, playerNo: 1, playerName: 'rPlayer', soundOn: state.soundOn,
      });
    }

    case 'UPDATE_GAME_STATE':
      return syncDerived({ ...state, ...action.payload });

    case 'SET_MOVING_STEP':
      return { ...state, movingStep: action.payload };

    case 'TOGGLE_SOUND':   return { ...state, soundOn: !state.soundOn };
    case 'SHOW_ALERT':     return { ...state, alertVisible: true };
    case 'HIDE_ALERT':     return { ...state, alertVisible: false };
    case 'RESTART_GAME':
      return syncDerived({ ...initialState(), soundOn: state.soundOn, noOfPlayers: state.noOfPlayers });

    default: return state;
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useGameEngine() {
  const [state, dispatch] = useReducer(reducer, null, initialState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const audioRef = useRef({});
  useEffect(() => {
    const files = {
      roll: '/music/diceRollingSound.mp3',
      open: '/music/open-sound.wav',
      jump: '/music/jump-sound.mp3',
      cut:  '/music/cut-sound.wav',
      pass: '/music/pass-sound.mp3',
      win:  '/music/win-sound.mp3',
    };
    for (const [k, v] of Object.entries(files)) {
      const a = new Audio(v);
      a.preload = 'auto';
      audioRef.current[k] = a;
    }
  }, []);

  const playSound = useCallback((name) => {
    if (!stateRef.current.soundOn) return;
    const a = audioRef.current[name];
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function getPawnOutCell(cls, s) {
    for (let i = 1; i <= 52; i++) {
      if (s.outAreaPos[i]?.includes(cls)) return i;
    }
    return null;
  }

  function getPawnPrivateCell(cls, s) {
    const pp = s.players[s.playerName].privateAreaPos;
    for (let i = 1; i <= 5; i++) {
      if (pp[i]?.includes(cls)) return i;
    }
    return null;
  }

  // ── nextPlayer ───────────────────────────────────────────────────────────────
  const nextPlayer = useCallback((s) => {
    if (s.winningOrder.length >= s.noOfPlayers - 1) {
      setTimeout(() => dispatch({ type: 'RESTART_GAME' }), 2000);
      return;
    }

    let playerNo = s.playerNo;
    const faceValue = s.diceValue !== null ? s.diceValue + 1 : 0;
    let countSix = s.countSix;
    let preDicePlayerNo = s.preDicePlayerNo;

    const shouldAdvance = (faceValue !== 6 && !s.cut && !s.pass) || countSix === 3;
    if (shouldAdvance) {
      playerNo = playerNo % 4 + 1;
      countSix = 0;
      preDicePlayerNo = null;
    }
    if (s.cut || s.pass) { countSix = 0; preDicePlayerNo = null; }

    let attempts = 0;
    while (attempts < 4) {
      const pName = getPlayerName(playerNo);
      const p = s.players[pName];
      if (p.winArea.length === 4 || (p.inArea.length === 0 && p.outArea.length === 0 && p.privateArea.length === 0)) {
        playerNo = playerNo % 4 + 1;
        attempts++;
      } else break;
    }

    dispatch({
      type: 'UPDATE_GAME_STATE',
      payload: {
        ...s,
        playerNo,
        playerName: getPlayerName(playerNo),
        countSix,
        preDicePlayerNo,
        cut: false, pass: false,
        diceValue: null, diceRolling: false, diceVisible: false,
        glowPawns: [],
        movingPawn: null, movingPath: [], movingStep: 0,
        phase: PHASE.WAITING_ROLL,
      },
    });
  }, []);

  // ── rollDice ─────────────────────────────────────────────────────────────────
  const rollDice = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== PHASE.WAITING_ROLL) return;

    dispatch({ type: 'UPDATE_GAME_STATE', payload: { ...s, diceRolling: true, diceVisible: false, phase: PHASE.ROLLING } });
    playSound('roll');

    // Animação de rolagem: 1200ms, depois mostra resultado por 800ms
    setTimeout(() => {
      const s2 = stateRef.current;
      const rndmNo = Math.floor(Math.random() * 6);
      const faceValue = rndmNo + 1;

      let countSix = s2.countSix;
      let preDicePlayerNo = s2.preDicePlayerNo;
      if ((preDicePlayerNo === null || preDicePlayerNo === s2.playerNo) && faceValue === 6) countSix++;

      const newS = {
        ...s2,
        diceValue: rndmNo,
        countSix,
        preDicePlayerNo: s2.playerNo,
        diceRolling: false,
        diceVisible: true,
        phase: PHASE.CHOOSING_PAWN,
        glowPawns: [],
      };
      dispatch({ type: 'UPDATE_GAME_STATE', payload: newS });

      // Pausa para ver o resultado antes de agir
      setTimeout(() => afterRoll(newS), 900);
    }, 1200);
  }, [playSound]);

  // ── afterRoll ────────────────────────────────────────────────────────────────
  const afterRoll = useCallback((s) => {
    const { playerName, players, diceValue, countSix } = s;
    const p = players[playerName];
    const faceValue = diceValue + 1;

    if (countSix === 3) {
      setTimeout(() => nextPlayer(s), 400);
      return;
    }

    const glows = [];

    if (faceValue === 6) {
      for (const cls of p.inArea) glows.push(cls);
    }
    for (const cls of p.outArea) {
      if (!glows.includes(cls)) glows.push(cls);
    }
    for (const cls of p.privateArea) {
      const pos = getPawnPrivateCell(cls, s);
      if (pos !== null && faceValue <= 5 - pos + 1) {
        if (!glows.includes(cls)) glows.push(cls);
      }
    }

    if (glows.length === 0) {
      setTimeout(() => nextPlayer(s), 400);
      return;
    }

    const inGlows   = glows.filter(g => p.inArea.includes(g));
    const outGlows  = glows.filter(g => p.outArea.includes(g));
    const privGlows = glows.filter(g => p.privateArea.includes(g));

    // Auto-mover quando só há uma opção
    if (inGlows.length === 0 && outGlows.length === 1 && privGlows.length === 0) {
      performMoveOnOutArea(outGlows[0], s); return;
    }
    if (inGlows.length === 0 && outGlows.length === 0 && privGlows.length === 1) {
      performMoveOnPrivateArea(privGlows[0], s); return;
    }
    if (faceValue === 6 && inGlows.length > 0 && outGlows.length === 0 && privGlows.length === 0) {
      autoOpen(s); return;
    }

    dispatch({ type: 'UPDATE_GAME_STATE', payload: { ...s, glowPawns: glows, phase: PHASE.CHOOSING_PAWN } });
  }, [nextPlayer]);

  function autoOpen(s) {
    const p = s.players[s.playerName];
    const idx = Math.floor(Math.random() * p.inArea.length);
    performOpen(p.inArea[idx], s);
  }

  // ── performOpen ──────────────────────────────────────────────────────────────
  const performOpen = useCallback((cls, s) => {
    const { playerName, players, outAreaPos } = s;
    const startNo = getNoFromValue(players[playerName].startPoint);

    const newPlayers = { ...s.players };
    newPlayers[playerName] = {
      ...newPlayers[playerName],
      inArea:   removeFromArea(newPlayers[playerName].inArea, cls),
      outArea:  addToArea(newPlayers[playerName].outArea, cls),
    };
    const newOutAreaPos = addToPos(outAreaPos, startNo, cls);
    playSound('open');

    const newS = { ...s, players: newPlayers, outAreaPos: newOutAreaPos, glowPawns: [], phase: PHASE.MOVING };
    dispatch({ type: 'UPDATE_GAME_STATE', payload: newS });
    setTimeout(() => nextPlayer(newS), 700);
  }, [playSound, nextPlayer]);

  // ── Calcular caminho de movimento ────────────────────────────────────────────
  function buildOutAreaPath(startNoInId, steps, playerName, players) {
    const endNo = getNoFromValue(players[playerName].endPoint);
    const path = [];
    let noInId = startNoInId;
    let inPrivate = false;
    let privatePos = 0;

    for (let step = 0; step < steps; step++) {
      if (inPrivate) {
        if (privatePos >= 5) break; // já no centro
        privatePos++;
        const color = playerName.charAt(0);
        path.push(color + '-out-' + privatePos);
      } else {
        if (noInId === endNo) {
          // Entra no privado
          inPrivate = true;
          privatePos = 1;
          const color = playerName.charAt(0);
          path.push(color + '-out-' + privatePos);
        } else {
          noInId = noInId >= 52 ? 1 : noInId + 1;
          path.push('out' + noInId);
        }
      }
    }
    return path;
  }

  function buildPrivatePath(startPos, steps, color) {
    const path = [];
    let pos = startPos;
    for (let step = 0; step < steps; step++) {
      if (pos >= 5) break;
      pos++;
      path.push(color + '-out-' + pos);
    }
    return path;
  }

  // ── performMoveOnOutArea com animação ────────────────────────────────────────
  const performMoveOnOutArea = useCallback((cls, s) => {
    const { playerName, players, outAreaPos, diceValue } = s;
    const steps = diceValue + 1;
    const color = getColorFromValue(cls);

    let startNoInId = getPawnOutCell(cls, s);
    if (startNoInId === null) return;

    const path = buildOutAreaPath(startNoInId, steps, playerName, players);

    // Calcula estado final
    let noInId = startNoInId;
    let curPlayers = JSON.parse(JSON.stringify(players));
    let curOutAreaPos = JSON.parse(JSON.stringify(outAreaPos));
    let cut = false, pass = false, winAchieved = false;
    let newWinningOrder = [...s.winningOrder];
    let winBadges = { ...s.winBadges };
    let inPrivate = false, privatePos = null;

    for (let step = 0; step < steps; step++) {
      if (inPrivate) {
        curPlayers[playerName].privateAreaPos[privatePos] =
          removeFromArea(curPlayers[playerName].privateAreaPos[privatePos], cls);
        if (checkPrivateAreaEnd(privatePos)) {
          curPlayers[playerName].privateArea = removeFromArea(curPlayers[playerName].privateArea, cls);
          curPlayers[playerName].winArea = addToArea(curPlayers[playerName].winArea, cls);
          pass = true;
          if (curPlayers[playerName].winArea.length === 4) {
            winAchieved = true;
            newWinningOrder = addToArea(newWinningOrder, playerName);
            const badgeNo = newWinningOrder.length;
            if (badgeNo <= 3) winBadges[playerName] = badgeNo;
          }
          inPrivate = false; privatePos = null;
        } else {
          privatePos++;
          curPlayers[playerName].privateAreaPos[privatePos] =
            addToArea(curPlayers[playerName].privateAreaPos[privatePos] || [], cls);
        }
        continue;
      }
      if (checkOutAreaEnd(noInId, playerName, curPlayers)) {
        curOutAreaPos[noInId] = removeFromArea(curOutAreaPos[noInId], cls);
        curPlayers[playerName].outArea = removeFromArea(curPlayers[playerName].outArea, cls);
        curPlayers[playerName].privateArea = addToArea(curPlayers[playerName].privateArea, cls);
        privatePos = 1;
        curPlayers[playerName].privateAreaPos[1] = addToArea(curPlayers[playerName].privateAreaPos[1] || [], cls);
        inPrivate = true; noInId = null;
      } else {
        curOutAreaPos[noInId] = removeFromArea(curOutAreaPos[noInId], cls);
        noInId = noInId >= 52 ? 1 : noInId + 1;
        curOutAreaPos[noInId] = addToArea(curOutAreaPos[noInId] || [], cls);
      }
    }

    // Corte
    if (noInId !== null && !inPrivate && !SAFE_SQUARES.includes(noInId)) {
      const cellPawns = curOutAreaPos[noInId] || [];
      for (const other of cellPawns) {
        if (other !== cls && getColorFromValue(other) !== color) {
          const otherColor = getColorFromValue(other);
          const otherPName = otherColor + 'Player';
          curOutAreaPos[noInId] = removeFromArea(curOutAreaPos[noInId], other);
          curPlayers[otherPName].outArea = removeFromArea(curPlayers[otherPName].outArea, other);
          curPlayers[otherPName].inArea = addToArea(curPlayers[otherPName].inArea, other);
          cut = true;
          break;
        }
      }
    }

    if (winAchieved) playSound('win');
    else if (pass) playSound('pass');

    // Inicia animação passo a passo
    const animState = {
      ...s,
      glowPawns: [],
      phase: PHASE.MOVING,
      movingPawn: cls,
      movingPath: path,
      movingStep: 0,
    };
    dispatch({ type: 'UPDATE_GAME_STATE', payload: animState });

    // Anima cada passo
    const STEP_MS = 320;
    path.forEach((_, i) => {
      setTimeout(() => {
        playSound('jump');
        dispatch({ type: 'SET_MOVING_STEP', payload: i + 1 });
      }, (i + 1) * STEP_MS);
    });

    // Após animação, aplica estado final
    setTimeout(() => {
      if (cut) playSound('cut');
      const finalS = {
        ...s,
        players: curPlayers,
        outAreaPos: curOutAreaPos,
        cut, pass,
        glowPawns: [],
        winningOrder: newWinningOrder,
        winBadges,
        phase: PHASE.MOVING,
        movingPawn: null, movingPath: [], movingStep: 0,
      };
      dispatch({ type: 'UPDATE_GAME_STATE', payload: finalS });
      setTimeout(() => nextPlayer(finalS), winAchieved ? 1200 : 400);
    }, (path.length + 1) * STEP_MS);

  }, [playSound, nextPlayer]);

  // ── performMoveOnPrivateArea com animação ────────────────────────────────────
  const performMoveOnPrivateArea = useCallback((cls, s) => {
    const { playerName, players, diceValue } = s;
    const steps = diceValue + 1;
    const color = getColorFromValue(cls);

    let startPos = getPawnPrivateCell(cls, s);
    if (startPos === null) return;

    const path = buildPrivatePath(startPos, steps, color);

    let pos = startPos;
    let curPlayers = JSON.parse(JSON.stringify(players));
    let pass = false, winAchieved = false;
    let newWinningOrder = [...s.winningOrder];
    let winBadges = { ...s.winBadges };

    for (let step = 0; step < steps; step++) {
      curPlayers[playerName].privateAreaPos[pos] = removeFromArea(curPlayers[playerName].privateAreaPos[pos], cls);
      if (checkPrivateAreaEnd(pos)) {
        curPlayers[playerName].privateArea = removeFromArea(curPlayers[playerName].privateArea, cls);
        curPlayers[playerName].winArea = addToArea(curPlayers[playerName].winArea, cls);
        pass = true;
        if (curPlayers[playerName].winArea.length === 4) {
          winAchieved = true;
          newWinningOrder = addToArea(newWinningOrder, playerName);
          const badgeNo = newWinningOrder.length;
          if (badgeNo <= 3) winBadges[playerName] = badgeNo;
        }
        break;
      } else {
        pos++;
        curPlayers[playerName].privateAreaPos[pos] = addToArea(curPlayers[playerName].privateAreaPos[pos] || [], cls);
      }
    }

    if (winAchieved) playSound('win');
    else if (pass) playSound('pass');

    const animState = {
      ...s, glowPawns: [], phase: PHASE.MOVING,
      movingPawn: cls, movingPath: path, movingStep: 0,
    };
    dispatch({ type: 'UPDATE_GAME_STATE', payload: animState });

    const STEP_MS = 320;
    path.forEach((_, i) => {
      setTimeout(() => {
        playSound('jump');
        dispatch({ type: 'SET_MOVING_STEP', payload: i + 1 });
      }, (i + 1) * STEP_MS);
    });

    setTimeout(() => {
      const finalS = {
        ...s, players: curPlayers, pass, glowPawns: [],
        winningOrder: newWinningOrder, winBadges,
        phase: PHASE.MOVING,
        movingPawn: null, movingPath: [], movingStep: 0,
      };
      dispatch({ type: 'UPDATE_GAME_STATE', payload: finalS });
      setTimeout(() => nextPlayer(finalS), winAchieved ? 1200 : 400);
    }, (path.length + 1) * STEP_MS);

  }, [playSound, nextPlayer]);

  // ── onPawnClick ──────────────────────────────────────────────────────────────
  const onPawnClick = useCallback((cls) => {
    const s = stateRef.current;
    if (!s.glowPawns.includes(cls)) return;
    if (s.phase !== PHASE.CHOOSING_PAWN) return;

    const { playerName, players } = s;
    const p = players[playerName];

    if (p.inArea.includes(cls))       performOpen(cls, s);
    else if (p.outArea.includes(cls)) performMoveOnOutArea(cls, s);
    else if (p.privateArea.includes(cls)) performMoveOnPrivateArea(cls, s);
  }, [performOpen, performMoveOnOutArea, performMoveOnPrivateArea]);

  // ── Ações públicas ───────────────────────────────────────────────────────────
  const setNoOfPlayers = useCallback((n) => dispatch({ type: 'SET_NO_OF_PLAYERS', payload: n }), []);
  const startGame      = useCallback(() => dispatch({ type: 'START_GAME' }), []);
  const toggleSound    = useCallback(() => dispatch({ type: 'TOGGLE_SOUND' }), []);
  const showAlert      = useCallback(() => dispatch({ type: 'SHOW_ALERT' }), []);
  const hideAlert      = useCallback(() => dispatch({ type: 'HIDE_ALERT' }), []);
  const confirmRestart = useCallback(() => {
    dispatch({ type: 'RESTART_GAME' });
    dispatch({ type: 'HIDE_ALERT' });
  }, []);
  const openFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }, []);
  const closeFullscreen = useCallback(() => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }, []);

  return {
    state, setNoOfPlayers, startGame, rollDice, onPawnClick,
    toggleSound, showAlert, hideAlert, confirmRestart, openFullscreen, closeFullscreen,
  };
}

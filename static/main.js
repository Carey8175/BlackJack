// static/main.js

const socket = io();

// 前端缓存的当前玩家ID
let currentPlayerID = null;

// 绑定前端页面元素
const joinPanel = document.getElementById('join-panel');
const gamePanel = document.getElementById('game-panel');
const joinMsg = document.getElementById('joinMsg');
const playerInfo = document.getElementById('playerInfo');
const gameStateArea = document.getElementById('gameStateArea');

const btnJoin = document.getElementById('btnJoin');
const btnStart = document.getElementById('btnStart');
const btnBet = document.getElementById('btnBet');
const btnHit = document.getElementById('btnHit');
const btnStand = document.getElementById('btnStand');
const btnDouble = document.getElementById('btnDouble');
const btnSurrender = document.getElementById('btnSurrender');

// ========== 事件监听 ==========

// 加入游戏
btnJoin.addEventListener('click', () => {
  const playerName = document.getElementById('playerName').value.trim();
  if (!playerName) {
    joinMsg.textContent = "请先输入昵称！";
    return;
  }
  socket.emit('join', { playerName });
});

// 开始新一轮
btnStart.addEventListener('click', () => {
  socket.emit('start_game');
});

// 下注
btnBet.addEventListener('click', () => {
  const betAmount = parseInt(document.getElementById('betAmount').value) || 0;
  const sideBetBao = parseInt(document.getElementById('sideBetBao').value) || 0;
  const sideBetDui = parseInt(document.getElementById('sideBetDui').value) || 0;
  socket.emit('place_bet', {
    playerID: currentPlayerID,
    bet: betAmount,
    sideBetBao,
    sideBetDui
  });
});

// 要牌
btnHit.addEventListener('click', () => {
  socket.emit('hit', { playerID: currentPlayerID });
});

// 停牌
btnStand.addEventListener('click', () => {
  socket.emit('stand', { playerID: currentPlayerID });
});

// 双倍
btnDouble.addEventListener('click', () => {
  socket.emit('double', { playerID: currentPlayerID });
});

// 投降
btnSurrender.addEventListener('click', () => {
  socket.emit('surrender', { playerID: currentPlayerID });
});

// ========== SocketIO 回调 ==========

// 当成功连接到服务器
socket.on('connect', () => {
  console.log("已连接到服务器");
});

// 当加入游戏的结果
socket.on('join_result', data => {
  if (data.success) {
    currentPlayerID = data.playerID;
    // 隐藏登录面板，显示游戏面板
    joinPanel.style.display = "none";
    gamePanel.style.display = "block";
    playerInfo.textContent = data.name + " (ID: " + data.playerID + ")";
  } else {
    joinMsg.textContent = data.message;
  }
});

// 接收游戏状态并渲染
socket.on('game_state', (state) => {
  renderGameState(state);
});

// ========== 前端渲染核心逻辑 (环形牌桌) ==========

/**
 * 如果 rank='?' & suit='?' => 显示背面图
 * 否则映射到 e.g. "AH.png" / "ace_of_hearts.svg" 等
 */
function getCardImageHtml(card) {
  // 如果是暗牌 => 用 card_back.png
  if (card.rank === '?' && card.suit === '?') {
    return `<img src="/static/imgs/cards/card_back.png" class="card-img" />`;
  }

  // 映射
  const suitMap = { '♥':'hearts', '♦':'diamonds', '♣':'clubs', '♠':'spades' };
  const rankMap = { 'A':'ace','K':'king','Q':'queen','J':'jack','10':'10','9':'9','8':'8','7':'7','6':'6','5':'5','4':'4','3':'3','2':'2' };

  let suitChar = suitMap[card.suit] || 'X';
  let rankChar = rankMap[card.rank] || card.rank;

  // 例如 "ace_of_hearts.svg"
  let fileName = `${rankChar}_of_${suitChar}.svg`;
  let imgPath = `/static/imgs/cards/${fileName}`;

  return `<img src="${imgPath}" class="card-img" />`;
}

function getCardsHtml(cards) {
  let html = '<div class="cards-container">';
  cards.forEach(c => {
    html += getCardImageHtml(c);
  });
  html += '</div>';
  return html;
}

function renderGameState(state) {
  // 1) 是否所有闲家都已下注
  const allNonDealerBet = state.players
    .filter(p => !p.isDealer)
    .every(p => p.bet > 0);

  // 2) 是否所有闲家都已停牌或爆牌
  const allNonDealerDone = state.players
    .filter(p => !p.isDealer)
    .every(p => p.isStanding || p.isBusted);

  // 准备渲染
  let seatsHtml = "";
  const totalPlayers = state.players.length;

  // 找到“自己”在 state.players 里的下标
  const myIndexInArray = state.players.findIndex(p => p.playerID === currentPlayerID);
  // 如果没找到，可能还没加入 or 出错
  // if (myIndexInArray === -1) return;

  // 圆桌中心 (300, 300), 半径 200 (可调整)
  const centerX = 300;
  const centerY = 300;
  const radius = 200;

  // 遍历 i=0..(n-1)
  // 让 i=0 => “自己”， i=1 => 自己后面的玩家...
  // 这样自己就可以固定在 angle = +π/2 => 圆桌正下方
  for (let i = 0; i < totalPlayers; i++) {
    // realIndex: 在 players 中的实际下标
    let realIndex = (i + myIndexInArray) % totalPlayers;
    let p = state.players[realIndex];

    // 计算角度: i=0 => +π/2 (正下方)
    // i=1 => +π/2 + 2π / totalPlayers => 顺时针
    let angle = (2 * Math.PI * i / totalPlayers) + Math.PI/2;

    // 计算座位绝对坐标
    let x = centerX + radius * Math.cos(angle);
    let y = centerY + radius * Math.sin(angle);

    // ------ 常规暗牌逻辑 -------
    let displayPoint = (typeof p.handValue !== 'undefined') ? p.handValue : "?";
    let cardsToShow = [...p.hand];
    if (!allNonDealerBet) {
      displayPoint = "??";
      cardsToShow = cardsToShow.map(() => ({ rank:'?', suit:'?' }));
    } else {
      if (!allNonDealerDone) {
        // 闲家有人还在操作 => 庄家暗牌, 闲家明牌
        if (p.isDealer) {
          displayPoint = "??";
          if (p.hand.length >= 2) {
            let first = p.hand[0];
            let hiddenRest = p.hand.slice(1).map(() => ({ rank:'?', suit:'?' }));
            cardsToShow = [first, ...hiddenRest];
          }
        }
      }
      // else => 所有闲家都结束 => 庄家全亮
    }

    let cardHtml = getCardsHtml(cardsToShow);

    // 爆了/停牌 标识
    let bustedTag = p.isBusted ? " (爆了)" : "";
    let standingTag = p.isStanding ? " (停牌)" : "";

    // 是否自己
    let isMe = (p.playerID === currentPlayerID);

    // 如果是庄家 => 名字默认 + [庄家]红色
    // 如果是自己(且不是庄家) => 名字黄
    let playerNameHtml = p.isDealer
      ? `玩家${realIndex}：${p.name} <span style="color:red;">[庄家]</span>`
      : (isMe
          ? `<span style="color: yellow;">玩家${realIndex}：${p.name}</span>`
          : `玩家${realIndex}：${p.name}`);

    seatsHtml += `
      <div class="seat" style="top:${y}px; left:${x}px;">
        <div class="seat-name">
          ${playerNameHtml}
        </div>
        <div class="seat-cards">
          ${cardHtml}
        </div>
        <div class="seat-info">
          <div>点数=${displayPoint} ${bustedTag} ${standingTag}</div>
          <div>金币：${p.coins}</div>
          <div>注：${p.bet}，爆：${p.sideBetBao}，对：${p.sideBetDui}</div>
        </div>
      </div>
    `;
  }

  // 构造桌子HTML
  let tableHtml = `
    <div class="table-container">
      <div class="round-indicator">第 ${state.roundNumber} 轮</div>
      ${seatsHtml}
    </div>
  `;
  // 放进 #gameStateArea
  gameStateArea.innerHTML = tableHtml;

  // ====== 启用/禁用 下注按钮 ======
  if (!allNonDealerBet) {
    btnBet.disabled = false;
  } else {
    btnBet.disabled = true;
  }

  // ====== 控制要牌/停牌按钮 ======
  // (不变)
  const myIndex = state.players.findIndex(p => p.playerID === currentPlayerID);
  if (myIndex === -1) return;

  let isMyTurn = false;
  if (myIndex === state.currentPlayerIndex) {
    const me = state.players[myIndex];
    if (!me.isBusted && !me.isStanding) {
      isMyTurn = true;
    }
  }

  if (isMyTurn) {
    btnHit.disabled = false;
    btnStand.disabled = false;
    btnDouble.disabled = false;
    btnSurrender.disabled = false;

    btnHit.style.backgroundColor = "#f0ad4e";
    btnStand.style.backgroundColor = "#f0ad4e";
    btnDouble.style.backgroundColor = "#f0ad4e";
    btnSurrender.style.backgroundColor = "#f0ad4e";

    // 播放提示音
    const audio = document.getElementById('turnSound');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(err => {
        console.warn("音频播放被阻止了:", err);
      });
    }
  } else {
    btnHit.disabled = true;
    btnStand.disabled = true;
    btnDouble.disabled = true;
    btnSurrender.disabled = true;

    btnHit.style.backgroundColor = "#ccc";
    btnStand.style.backgroundColor = "#ccc";
    btnDouble.style.backgroundColor = "#ccc";
    btnSurrender.style.backgroundColor = "#ccc";
  }

  // ====== “开始新一轮”按钮（庄家专用） ======
  const isDealer = (myIndex === state.dealerIndex);
  if (isDealer) {
    btnStart.disabled = false;
    btnStart.style.backgroundColor = "green";
  } else {
    btnStart.disabled = true;
    btnStart.style.backgroundColor = "red";
  }
}

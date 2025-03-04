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

// ========== 前端渲染核心逻辑 ==========

/**
 * 根据单张牌对象 {rank, suit} 返回 <img> 标记。
 * 若 rank='?'&suit='?' => 显示背面图。
 */
function getCardImageHtml(card) {
  // 如果是暗牌 => 用 card_back.png
  if (card.rank === '?' && card.suit === '?') {
    return `<img src="/static/imgs/cards/card_back.png" class="card-img" />`;
  }

  // 否则映射花色 & 点数到文件名 (如 'A'+'H' => 'AH.png')
  const suitMap = { '♥':'hearts', '♦':'diamonds', '♣':'clubs', '♠':'spades' };
  // 可能 rankMap 也要
  const rankMap = { 'A':'ace','K':'king','Q':'queen','J':'jack','10':'10','9':'9','8':'8','7':'7','6':'6','5':'5','4':'4','3':'3','2':'2' };

  let suitChar = suitMap[card.suit] || 'X';
  let rankChar = rankMap[card.rank] || card.rank;

  // 拼接文件名 => AH.png / 10S.png
  let fileName = `${rankChar}_of_${suitChar}.svg`;
  let imgPath = `/static/imgs/cards/${fileName}`;

  return `<img src="${imgPath}" class="card-img" />`;
}

/**
 * 把一组 card 对象组合成 HTML (若有多张牌)
 */
function getCardsHtml(cards) {
  let html = '<div class="cards-container">';
  cards.forEach(c => {
    html += getCardImageHtml(c);
  });
  html += '</div>';
  return html;
}

/**
 * 真正的渲染函数:
 *  - 控制何时显示庄家暗牌/闲家牌
 *  - 启用/禁用下注 & 操作按钮
 *  - 当轮到自己时播放音效
 */
function renderGameState(state) {
  // 1) 是否所有闲家都已下注
  const allNonDealerBet = state.players
    .filter(p => !p.isDealer)
    .every(p => p.bet > 0);

  // 2) 是否所有闲家都已停牌或爆牌
  const allNonDealerDone = state.players
    .filter(p => !p.isDealer)
    .every(p => p.isStanding || p.isBusted);

  let html = "";
  html += `<p>第 ${state.roundNumber} 轮游戏</p>`;
  html += `<p>当前轮到玩家索引: ${state.currentPlayerIndex}</p>`;
  html += "<hr><ul>";

  // 遍历每位玩家,拼接HTML
  state.players.forEach((p, index) => {
    const dealerTag = p.isDealer ? " [庄家]" : "";
    const bustedTag = p.isBusted ? " (爆了)" : "";
    const standingTag = p.isStanding ? " (停牌)" : "";

    // 如果后端给了 p.handValue，就用它; 否则显示 "?"
    let displayPoint = (typeof p.handValue !== 'undefined') ? p.handValue : "?";

    // 默认: 显示玩家的实际牌
    let cardsToShow = [...p.hand];

    if (!allNonDealerBet) {
      // 还没人(或有人没)下注 => 全场隐藏
      displayPoint = "??";
      cardsToShow = cardsToShow.map(() => ({rank:'?', suit:'?'}));
    } else {
      // 大家都下注了
      if (!allNonDealerDone) {
        // 闲家有人还在打 => 庄家暗牌, 闲家明牌
        if (p.isDealer) {
          displayPoint = "??";
          if (p.hand.length >= 2) {
            let first = p.hand[0];
            let hiddenRest = p.hand.slice(1).map(() => ({ rank:'?', suit:'?' }));
            cardsToShow = [first, ...hiddenRest];
          }
        }
      } else {
        // 所有闲家都结束 => 庄家全亮
        // 不改 cardsToShow
        // displayPoint = p.handValue
      }
    }

    let cardHtml = getCardsHtml(cardsToShow);

    // 拼接玩家信息
    html += `<li>`;
    html += `玩家${index}：${p.name}${dealerTag}<br>`;
    html += `${cardHtml}<br>`;
    html += `点数=${displayPoint} ${bustedTag} ${standingTag}<br>`;
    html += `金币：${p.coins}，普通下注：${p.bet}，压爆：${p.sideBetBao}，压对：${p.sideBetDui}`;
    html += `</li><br>`;
  });

  html += "</ul><hr>";
  gameStateArea.innerHTML = html;

  // ========== 启用/禁用下注按钮 ==========
  if (!allNonDealerBet) {
    btnBet.disabled = false;  // 还有人没下注 => 可以下注
  } else {
    btnBet.disabled = true;   // 大家都下注 => 禁用下注
  }

  // ========== 控制要牌/停牌按钮 ==========
  // 找到我是谁
  const myIndex = state.players.findIndex(p => p.playerID === currentPlayerID);
  if (myIndex === -1) return; // 没找到自己就不处理
  let isMyTurn = false;
  if (myIndex === state.currentPlayerIndex) {
    const me = state.players[myIndex];
    if (!me.isBusted && !me.isStanding) {
      isMyTurn = true;
    }
  }

  if (isMyTurn) {
    // 启用Hit/Stand/Double/Surrender
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
    // 不在我回合 => 禁用
    btnHit.disabled = true;
    btnStand.disabled = true;
    btnDouble.disabled = true;
    btnSurrender.disabled = true;

    btnHit.style.backgroundColor = "#ccc";
    btnStand.style.backgroundColor = "#ccc";
    btnDouble.style.backgroundColor = "#ccc";
    btnSurrender.style.backgroundColor = "#ccc";
  }

  // ========== “开始新一轮”按钮（庄家专用） ==========
  const isDealer = (myIndex === state.dealerIndex);
  if (isDealer) {
    btnStart.disabled = false;
    btnStart.style.backgroundColor = "green";
  } else {
    btnStart.disabled = true;
    btnStart.style.backgroundColor = "red";
  }
}

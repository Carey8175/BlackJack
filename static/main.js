// static/main.js

const socket = io();

// 前端缓存的当前玩家ID
let currentPlayerID = null;

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
const btnDouble = document.getElementById('btnDouble');      // 新增
const btnSurrender = document.getElementById('btnSurrender');// 新增

// ========== 事件监听 ==========

btnJoin.addEventListener('click', () => {
  const playerName = document.getElementById('playerName').value.trim();
  if (!playerName) {
    joinMsg.textContent = "请先输入昵称！";
    return;
  }
  socket.emit('join', { playerName });
});

btnStart.addEventListener('click', () => {
  socket.emit('start_game');
});

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

btnHit.addEventListener('click', () => {
  socket.emit('hit', { playerID: currentPlayerID });
});

btnStand.addEventListener('click', () => {
  socket.emit('stand', { playerID: currentPlayerID });
});

btnDouble.addEventListener('click', () => {
  socket.emit('double', { playerID: currentPlayerID });
});

btnSurrender.addEventListener('click', () => {
  socket.emit('surrender', { playerID: currentPlayerID });
});

// ========== SocketIO 回调 ==========

socket.on('connect', () => {
  console.log("已连接到服务器");
});

socket.on('join_result', data => {
  if (data.success) {
    currentPlayerID = data.playerID;
    joinPanel.style.display = "none";
    gamePanel.style.display = "block";
    playerInfo.textContent = data.name + " (ID: " + data.playerID + ")";
  } else {
    joinMsg.textContent = data.message;
  }
});

socket.on('game_state', (state) => {
  renderGameState(state);
});

// ========== 前端渲染核心逻辑 ==========

function renderGameState(state) {
  // 1) 是否所有闲家都已下注
  const allNonDealerBet = state.players
    .filter(p => !p.isDealer)
    .every(p => p.bet > 0);

  // 2) 是否所有闲家都已停牌或爆牌 (不关心庄家是否 standing)
  //    只要闲家都结束 => 我们就“看牌”庄家所有手牌
  const allNonDealerDone = state.players
    .filter(p => !p.isDealer)
    .every(p => p.isStanding || p.isBusted);

  let html = "";
  html += `<p>第 ${state.roundNumber} 轮游戏</p>`;
  html += `<p>当前轮到玩家索引: ${state.currentPlayerIndex}</p>`;
  html += "<hr><ul>";

  state.players.forEach((p, index) => {
    const dealerTag = p.isDealer ? " [庄家]" : "";
    const bustedTag = p.isBusted ? " (爆了)" : "";
    const standingTag = p.isStanding ? " (停牌)" : "";

    // 如果后端给了 p.handValue，就用它作为点数
    // 否则先用 "?"
    let displayPoint = (typeof p.handValue !== 'undefined')
                       ? p.handValue
                       : "?";

    // 把手牌对象 转成 "2♣  K♥" 这样的字符串
    function getCardString(cards) {
      return cards.map(c => c.rank + c.suit).join(" ");
    }

    let cardStr = "";

    // ----------------------------------------------------
    // 逻辑分支：
    // 1) 有闲家没下注 => 全场隐藏
    // 2) 闲家都下注，但闲家未全结束 => 闲家全显, 庄家暗牌
    // 3) 闲家都结束 => 庄家也亮全部
    // ----------------------------------------------------

    if (!allNonDealerBet) {
      // 启用下注按钮
        btnBet.disabled = false;

      // 若有人没下注 => 隐藏所有人的手牌 & 点数
      cardStr = p.hand.map(() => "??").join(" ");
      displayPoint = "??";

    } else {
      // 大家都下注了
      if (!allNonDealerDone) {
        // 禁用下注按钮
        btnBet.disabled = true;

        // 闲家有人还在打 => 庄家暗牌, 闲家正常
        if (p.isDealer) {
          // 庄家只显示第一张
          if (p.hand.length >= 2) {
            const firstCard = p.hand[0];
            const hidden = p.hand.slice(1).map(() => ({ rank:"?", suit:"?" }));
            const partial = [firstCard, ...hidden];
            cardStr = getCardString(partial);
          } else {
            // 如果庄家只有1张
            cardStr = getCardString(p.hand);
          }
          // 点数隐藏
          displayPoint = "??";
        } else {
          // 闲家 => 全显
          cardStr = getCardString(p.hand);
        }
      } else {
        // allNonDealerDone == true => 所有闲家都已停牌/爆牌 => 亮出庄家
        cardStr = getCardString(p.hand);
        // displayPoint 保持真实 p.handValue
      }
    }

    html += `<li>`;
    html += `玩家${index}：${p.name}${dealerTag}，手牌=[${cardStr}]，点数=${displayPoint} ${bustedTag} ${standingTag}<br>`;
    html += `金币：${p.coins}，普通下注：${p.bet}，压爆：${p.sideBetBao}，压对：${p.sideBetDui}`;
    html += `</li><br>`;
  });

  html += "</ul><hr>";
  gameStateArea.innerHTML = html;

  // ========== 控制按钮状态 ==========

  const myIndex = state.players.findIndex(p => p.playerID === currentPlayerID);
  if (myIndex === -1) return; // 若没找到自己 => 不处理

  // 要牌 / 停牌 => 仅当轮到我时启用
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
    // 改成柔和的橙色
    btnHit.style.backgroundColor = "#f0ad4e";
    btnStand.style.backgroundColor = "#f0ad4e";

    // 如果你还加了 Double / Surrender 按钮，也可以一起改
    btnDouble.disabled = false;
    btnSurrender.disabled = false;
    btnDouble.style.backgroundColor = "#f0ad4e";
    btnSurrender.style.backgroundColor = "#f0ad4e";

    const audio = document.getElementById('turnSound');
    if (audio) {
      audio.currentTime = 0; // 让音效从头开始
      audio.play().catch(err => {
        console.warn("音频播放被阻止了", err);
      });
    }

  } else {
    btnHit.disabled = true;
    btnStand.disabled = true;
    // 不可点击就保持灰色
    btnHit.style.backgroundColor = "#ccc";
    btnStand.style.backgroundColor = "#ccc";

    // Double / Surrender 同理
    btnDouble.disabled = true;
    btnSurrender.disabled = true;
    btnDouble.style.backgroundColor = "#ccc";
    btnSurrender.style.backgroundColor = "#ccc";
  }

  // “开始新一轮” => 只有庄家能点
  const isDealer = (myIndex === state.dealerIndex);
  if (isDealer) {
    btnStart.disabled = false;
    btnStart.style.backgroundColor = "green";
  } else {
    btnStart.disabled = true;
    btnStart.style.backgroundColor = "red";
  }
}

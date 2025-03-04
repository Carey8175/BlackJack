# app.py
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
from game_logic.blackjack_game import BlackjackGame

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# 全局唯一游戏对象（也可做成多房间，每个房间一个实例）
game = BlackjackGame(max_players=6, num_decks=4)

@app.route('/')
def index():
    # 仅返回一个极简文字前端
    return render_template('index.html')

@socketio.on('join')
def on_join(data):
    """
    data: { 'playerName': ... }
    如果发现已有同名玩家，就让当前socket连接接管该玩家(断线重连)；
    否则照常创建新玩家。
    """
    player_name = data.get('playerName')
    sid = request.sid  # 当前Socket连接id

    # 1. 先看看是否已有同名玩家
    existing_player = game.find_player_by_name(player_name)

    if existing_player:
        # 已有同名 => 复用该玩家对象
        existing_player.player_id = sid
        emit('join_result', {'success': True, 'playerID': sid, 'name': player_name}, room=sid)
        broadcast_game_state()
    else:
        # 2. 否则按原逻辑添加新玩家
        new_p = game.add_player(sid, player_name)
        if not new_p:
            # 人数已满
            emit('join_result', {'success': False, 'message': '房间已满'}, room=sid)
        else:
            emit('join_result', {'success': True, 'playerID': sid, 'name': player_name}, room=sid)
            broadcast_game_state()

@socketio.on('start_game')
def on_start_game():
    # 如果没有玩家，也就别开局了
    if len(game.players) == 0:
        return

    # 结算当前轮次
    if not game.round_settled:
        game.settle_bets()
        game.rotate_dealer()
    # 开始新一轮
    game.start_new_round()
    broadcast_game_state()

@socketio.on('place_bet')
def on_place_bet(data):
    if game.phase != 'BETTING':
        # 此时不允许下注，要么忽略，要么告诉前端“已经不能下注”
        emit('error_message', {'msg': '此时不可下注'}, room=request.sid)
        return

    # 否则是BETTING阶段，允许下注
    pid = data.get('playerID')
    bet = data.get('bet', 0)
    side_bet_bao = data.get('sideBetBao', 0)
    side_bet_dui = data.get('sideBetDui', 0)
    game.place_bet(pid, bet, side_bet_bao, side_bet_dui)
    broadcast_game_state()

@socketio.on('double')
def on_double(data):
    pid = data.get('playerID')
    # 直接调用 game.player_double(pid) 等逻辑
    game.player_double(pid)
    broadcast_game_state()

@socketio.on('surrender')
def on_surrender(data):
    pid = data.get('playerID')
    # 直接调用 game.player_surrender(pid)
    player = game.find_player_by_id(pid)
    if len(player.hand) == 2:
        game.player_surrender(pid)
        broadcast_game_state()


@socketio.on('hit')
def on_hit(data):
    pid = data.get('playerID')
    dealer = game.get_dealer()
    if dealer and dealer.player_id == pid:
        # 这是庄家 => 执行“庄家要牌”逻辑
        game.dealer_hit()
    else:
        game.player_hit(pid)

        # 如果该玩家爆了 => 自动切换到下一个玩家
        player = game.find_player_by_id(pid)
        if player and player.is_busted:
            game.next_player_turn()
    broadcast_game_state()

@socketio.on('stand')
def on_stand(data):
    pid = data.get('playerID')
    dealer = game.get_dealer()
    if dealer and dealer.player_id == pid:
        # 这是庄家 => 执行“庄家停牌”逻辑
        game.dealer_stand()
    else:
        # 普通玩家 => 执行闲家停牌
        game.player_stand(pid)
        game.next_player_turn()
    broadcast_game_state()


@socketio.on('next_turn')
def on_next_turn():
    """
    手动让下一个玩家操作，也可以在前端自动做。
    """
    game.next_player_turn()
    broadcast_game_state()

def broadcast_game_state():
    state = {
        'players': [],
        'dealerIndex': game.dealer_index,
        'currentPlayerIndex': game.current_player_index,
        'roundNumber': game.round_number,
        # 新增
        'showDealerHoleCard': game.dealer_done
    }
    for p in game.players:
        state['players'].append({
            'playerID': p.player_id,
            'name': p.name,
            'isDealer': p.is_dealer,
            'hand': p.hand,  # 原始手牌，前端再决定是否隐藏
            'handValue': p.get_hand_value(),
            'coins': p.coins,
            'bet': p.bet,
            'sideBetBao': p.side_bet_bao,
            'sideBetDui': p.side_bet_dui,
            'isBusted': p.is_busted,
            'isStanding': p.is_standing
        })
    socketio.emit('game_state', state)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)

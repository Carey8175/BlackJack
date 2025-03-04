# game_logic/blackjack_game.py
from .deck import Deck
from .player import Player
import math

class BlackjackGame:
    def __init__(self, max_players=6, num_decks=4):
        self.max_players = max_players
        self.players = []  # 0~5号玩家
        self.dealer_index = 0  # 庄家索引
        self.current_player_index = 0
        self.round_number = 0
        self.deck = Deck(num_decks)
        self.dealer_done = False
        self.phase = 'BETTING'  # 初始阶段为“等待下注”
        self.dealer_can_act = False

    def add_player(self, player_id, name):
        """
        添加玩家，如果位置已经满了就返回 None
        """
        if len(self.players) >= self.max_players:
            return None
        new_player = Player(player_id, name=name, is_dealer=False)
        self.players.append(new_player)
        return new_player

    def start_new_round(self):
        """
        开始新的牌局：
        1. 让所有玩家手牌、状态归零
        2. 轮到庄家的玩家设 is_dealer=True
        3. 洗牌、发牌
        """
        self.round_number += 1
        self.dealer_done = False
        self.dealer_can_act = False

        # 如果上一轮已经有庄家了，把庄家状态清空
        for p in self.players:
            p.reset_for_new_round()
            p.is_dealer = False

        # 当前庄家
        if self.dealer_index >= len(self.players):
            self.dealer_index = 0
        dealer = self.players[self.dealer_index]
        dealer.is_dealer = True

        # 如果牌太少或要重新洗牌，可以自行决定
        # 这里简单写一下
        if len(self.deck.cards) < 52 * 3:
            self.deck.build_deck()

        # 发牌：每个玩家 2 张，庄家 2 张
        for _ in range(2):
            for p in self.players:
                card = self.deck.deal_card()
                p.add_card(card)

        self.current_player_index = (self.dealer_index + 1) % len(self.players)

    def get_dealer(self):
        return self.players[self.dealer_index]

    def get_current_player(self):
        return self.players[self.current_player_index]

    def next_player_turn(self):
        """
        让下一个玩家行动
        如果所有玩家都完成了，则进入庄家阶段
        """
        # 找下一个非庄家的玩家
        start_index = self.current_player_index
        while True:
            self.current_player_index = (self.current_player_index + 1) % len(self.players)
            if self.current_player_index == start_index:
                # 回到原点，说明玩家都操作完了
                break
            if not self.players[self.current_player_index].is_dealer:
                # 只要找到一个是闲家，就让他行动
                if not self.players[self.current_player_index].is_busted and not self.players[self.current_player_index].is_standing:
                    return
        # 如果所有人都结束操作，就让庄家开始结算
        self.current_player_index = self.dealer_index
        self.dealer_play()

    def dealer_play(self):
        self.dealer_done = True
        dealer = self.get_dealer()
        # 庄家先补牌直到17点或以上
        while dealer.get_hand_value() < 17:
            dealer.add_card(self.deck.deal_card())

        # 如果爆了，这里就无需庄家再决策了
        if dealer.get_hand_value() > 21:
            self.dealer_done = True
            # 可以在这里直接结算并结束
            self.settle_bets()
            self.rotate_dealer()
        else:
            # 若 >= 17，给庄家一个选择空间
            self.dealer_can_act = True

    def dealer_hit(self):
        """
        庄家选择再要一张牌（前提是 dealer_can_act=True）
        """
        if not self.dealer_can_act:
            return

        dealer = self.get_dealer()
        dealer.add_card(self.deck.deal_card())
        if dealer.get_hand_value() > 21:
            # 爆牌 => 直接结算
            self.dealer_done = True
            self.dealer_can_act = False
            self.settle_bets()
            self.rotate_dealer()
        # 如果还没爆，庄家可继续选择要牌或停牌

    def dealer_stand(self):
        """
        庄家选择停牌
        """
        if not self.dealer_can_act:
            return

        # 结束庄家回合 => 结算
        self.dealer_done = True
        self.dealer_can_act = False
        self.settle_bets()
        self.rotate_dealer()

    def rotate_dealer(self):
        """
        6 轮后轮换，或你可以按每轮都轮换，这里示例每玩 6 轮就轮换一次
        """
        if self.round_number % 6 == 0:
            self.dealer_index = (self.dealer_index + 1) % len(self.players)

    def player_hit(self, player_id):
        """
        闲家请求要牌
        """
        player = self.find_player_by_id(player_id)
        if not player or player.is_dealer:
            return
        card = self.deck.deal_card()
        player.add_card(card)
        if player.get_hand_value() > 21:
            player.is_busted = True

    def player_stand(self, player_id):
        """
        闲家请求停牌
        """
        player = self.find_player_by_id(player_id)
        if not player or player.is_dealer:
            return
        player.is_standing = True

    def player_double(self, player_id):
        """
        1. bet翻倍
        2. 发一张牌给该玩家
        3. 变为standing
        4. 切换下一玩家
        """
        player = self.find_player_by_id(player_id)
        if not player or player.is_busted or player.is_standing:
            return

        # 需要检查玩家是否有足够金币来翻倍
        if player.coins >= player.bet:
            # bet 翻倍
            player.coins -= player.bet
            player.bet *= 2

            # 发一张牌
            card = self.deck.deal_card()
            player.add_card(card)

            # 若爆了，设 is_busted=True
            if player.get_hand_value() > 21:
                player.is_busted = True

            # 无论爆没爆，都设 standing
            player.is_standing = True

            # 切到下一个玩家
            self.next_player_turn()

    def player_surrender(self, player_id):
        """
        1. 失去一半赌注(自定义规则，也有人减半或其他)
        2. 直接standing= True，不可再操作
        3. 切换下一玩家
        """
        player = self.find_player_by_id(player_id)
        if not player or player.is_busted or player.is_standing:
            return

        # 常见规则：扣掉一半赌注(你也可以收全部一半?)
        # 这里假设 bet 的一半归庄家或房间，剩下的退还给玩家
        half_bet = player.bet // 2
        # 退还另外一半
        player.coins += (player.bet - half_bet)
        player.bet = half_bet

        player.is_busted = True

        self.next_player_turn()

    def place_bet(self, player_id, bet, side_bet_bao=0, side_bet_dui=0):
        """
        设置玩家的下注，包括普通赌注和两个 side bet
        """
        player = self.find_player_by_id(player_id)
        if not player or player.is_dealer:
            return
        if bet <= player.coins:
            player.bet += bet
            player.coins -= bet
        # 压爆(保险/看情况怎么处理)
        if side_bet_bao <= player.coins:
            player.side_bet_bao += side_bet_bao
            player.coins -= side_bet_bao
        # 压对
        if side_bet_dui <= player.coins:
            player.side_bet_dui += side_bet_dui
            player.coins -= side_bet_dui

    def settle_bets(self):
        """
        结算所有闲家 vs 庄家，处理 side bet 逻辑
        """
        dealer = self.get_dealer()
        dealer_value = dealer.get_hand_value()
        dealer_busted = (dealer_value > 21)

        for p in self.players:
            if p.is_dealer:
                continue
            if p.bet == 0:
                continue

            player_value = p.get_hand_value()
            player_busted = (player_value > 21)

            # 基本判断
            if player_busted:
                # 玩家爆牌  -> 输掉 bet
                # 庄家加钱
                dealer.coins += p.bet
            else:
                if dealer_busted:
                    # 庄家爆了 -> 玩家赢得 2倍 bet
                    p.coins += p.bet * 2
                    dealer.coins -= p.bet
                else:
                    # 都没爆 -> 比大小
                    if player_value > dealer_value:
                        p.coins += p.bet * 2
                        dealer.coins -= p.bet
                    elif player_value == dealer_value:
                        # 平局 -> 退还 bet
                        p.coins += p.bet
                    else:
                        # 庄家更大 -> 玩家输
                        dealer.coins += p.bet

            # side bet: 仅示例
            # “压对”可以理解为：如果前两张牌是对子，则获取某个赔率
            # “压爆”可以理解为：预测自己会爆或者庄家会爆，可根据需求自行设定规则
            # 这里示例：若玩家前两张是对子，就赢 side_bet_dui * 11
            if p.side_bet_dui > 0:
                first_rank = p.hand[0]['rank']
                second_rank = p.hand[1]['rank']
                if len(p.hand) >= 2 and first_rank == second_rank:
                    p.coins += p.side_bet_dui * 11
                    dealer.coins -= 10 * p.side_bet_dui

            # “压爆”示例：如果庄家爆牌就赢
            if p.side_bet_bao > 0:
                if dealer_busted:
                    if len(dealer.hand) >= 5:
                        # 5张牌爆牌
                        p.coins += p.side_bet_bao * 5
                        dealer.coins -= 4 * p.side_bet_bao
                    else:
                        p.coins += p.side_bet_bao * 2
                        dealer.coins -= p.side_bet_bao
                else:
                    dealer.coins += p.side_bet_bao

            # 黑杰克1.5倍赔率
            if len(p.hand) == 2 and player_value == 21:
                p.coins += int(p.bet * 0.5)
                dealer.coins -= int(p.bet * 0.5)

    def find_player_by_id(self, player_id):
        for p in self.players:
            if p.player_id == player_id:
                return p
        return None

    def find_player_by_name(self, name):
        for p in self.players:
            if p.name == name:
                return p
        return None
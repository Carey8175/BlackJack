# game_logic/player.py

class Player:
    def __init__(self, player_id, name="Player", is_dealer=False):
        self.player_id = player_id
        self.name = name
        self.is_dealer = is_dealer
        self.hand = []       # 当前手牌
        self.bet = 0         # 当前下注金额
        self.coins = 100    # 初始金币（也可每局都重置，看需求）
        self.is_busted = False
        self.is_standing = False
        self.side_bet_bao = 0   # 压爆金额
        self.side_bet_dui = 0   # 压对金额

    def reset_for_new_round(self):
        self.hand = []
        self.bet = 0
        self.is_busted = False
        self.is_standing = False
        self.side_bet_bao = 0
        self.side_bet_dui = 0

    def add_card(self, card):
        self.hand.append(card)

    def get_hand_value(self):
        """
        计算当前手牌的 Blackjack 值。A 可以当 1 也可以当 11，用最优值(<=21).
        """
        total = 0
        aces = 0
        for card in self.hand:
            total += card['value']
            if card['rank'] == 'A':
                aces += 1

        # 如果有 A，就尝试把它当做 11，只要不爆就行
        while aces > 0:
            if total + 10 <= 21:
                total += 10
            aces -= 1

        return total



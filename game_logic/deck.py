# game_logic/deck.py
import random

class Deck:
    def __init__(self, num_decks=4):
        """
        初始化 num_decks 副牌。Blackjack 通常一副牌52张，
        这里用4副=208张（可自行调整）。
        """
        self.num_decks = num_decks
        self.cards = []
        self.build_deck()

    def build_deck(self):
        """ 构建并洗牌 """
        suits = ['♠', '♥', '♦', '♣']
        ranks = [
            {'rank': 'A', 'value': 1},  # Ace可以算1或11，在结算时根据手牌情况判断
            {'rank': '2', 'value': 2},
            {'rank': '3', 'value': 3},
            {'rank': '4', 'value': 4},
            {'rank': '5', 'value': 5},
            {'rank': '6', 'value': 6},
            {'rank': '7', 'value': 7},
            {'rank': '8', 'value': 8},
            {'rank': '9', 'value': 9},
            {'rank': '10', 'value': 10},
            {'rank': 'J', 'value': 10},
            {'rank': 'Q', 'value': 10},
            {'rank': 'K', 'value': 10},
        ]
        self.cards = []
        for _ in range(self.num_decks):
            for suit in suits:
                for rank in ranks:
                    self.cards.append({
                        'suit': suit,
                        'rank': rank['rank'],
                        'value': rank['value']
                    })
        self.shuffle()

    def shuffle(self):
        random.shuffle(self.cards)

    def deal_card(self):
        """ 发一张牌 """
        if len(self.cards) == 0:
            self.build_deck()
        return self.cards.pop()

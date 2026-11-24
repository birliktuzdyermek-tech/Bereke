"""Explainable savings rules. Every tip names the rule, the period and the figures it comes from.

The same rules and thresholds are mirrored in lib/insights.ts for the sample account; the two are
checked against the same cases in the test suites. Tips are information from the user's own entries,
not financial advice.
"""

SHARE_LIMIT_PERCENT = 40     # one category takes at least this share of all expenses
GROWTH_LIMIT_PERCENT = 20    # expenses grew at least this much against the previous equal period
SUBSCRIPTION_LIMIT_PERCENT = 10  # active subscriptions take at least this share of average monthly expenses
SAVINGS_LIMIT_PERCENT = 10   # less than this share of income is left at the end of the period


def tenge(value):
    return f"{value:,}".replace(",", " ") + " ₸"


def percent(part, whole):
    """Whole percent, half up, integers only so that Python and JavaScript agree."""
    return (part * 100 + whole // 2) // whole


def build_insights(stats, subscriptions_total):
    """stats: the payload of analytics (months, from, to, income, expense, balance, previous, categories)."""
    months, expense, income, balance = stats["months"], stats["expense"], stats["income"], stats["balance"]
    where = f"Кезең {stats['from']} — {stats['to']}"
    found = []

    if expense > 0 and stats["categories"]:
        top = stats["categories"][0]
        if top["total"] * 100 >= expense * SHARE_LIMIT_PERCENT:
            share = percent(top["total"], expense)
            found.append(("category_share",
                f"«{top['category']}» санаты шығынның {share}%-ын құрайды ({tenge(top['total'])}). Осы бағытты қайта қарап көруге болады.",
                f"{where}: жалпы шығын {tenge(expense)}, санат {tenge(top['total'])} = {share}%. Ереже: бір санат ≥ {SHARE_LIMIT_PERCENT}%."))

    previous = stats["previous"]["expense"]
    if previous > 0 and expense * 100 >= previous * (100 + GROWTH_LIMIT_PERCENT):
        growth = percent(expense - previous, previous)
        found.append(("expense_growth",
            f"Шығын алдыңғы кезеңмен салыстырғанда {growth}%-ға өскен: {tenge(previous)} → {tenge(expense)}.",
            f"{where}: шығын {tenge(expense)}, алдыңғы тең кезеңде {tenge(previous)}. Ереже: өсім ≥ {GROWTH_LIMIT_PERCENT}%."))

    if subscriptions_total > 0 and expense > 0 and subscriptions_total * months * 100 >= expense * SUBSCRIPTION_LIMIT_PERCENT:
        share = percent(subscriptions_total * months, expense)
        found.append(("subscription_load",
            f"Белсенді жазылымдарға айына {tenge(subscriptions_total)} кетеді, бұл орташа айлық шығынның шамамен {share}%-ы.",
            f"{where}: белсенді жазылымдар {tenge(subscriptions_total)}/ай × {months} ай, жалпы шығын {tenge(expense)}. Ереже: үлес ≥ {SUBSCRIPTION_LIMIT_PERCENT}%."))

    if income > 0 and balance * 100 < income * SAVINGS_LIMIT_PERCENT:
        left = max(balance, 0)
        found.append(("low_savings",
            f"Кірістің тек {percent(left, income)}%-ы жұмсалмай қалды ({tenge(balance) if balance >= 0 else '−' + tenge(-balance)}).",
            f"{where}: кіріс {tenge(income)}, шығыс {tenge(expense)}. Ереже: қалдық кірістің {SAVINGS_LIMIT_PERCENT}%-ынан аз."))
    return [{"ruleCode": code, "message": message, "basis": basis, "periodStart": stats["from"], "periodEnd": stats["to"]}
            for code, message, basis in found]

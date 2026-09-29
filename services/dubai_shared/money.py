def parse_xaf(amount: int | str | None, label: str, minimum: int = 0) -> int:
    if isinstance(amount, bool) or amount is None:
        raise ValueError(f"{label} doit être un montant entier en FCFA.")
    if isinstance(amount, int):
        value = amount
    else:
        text = str(amount).strip()
        if not text.isdigit():
            raise ValueError(f"{label} doit être un montant entier en FCFA.")
        value = int(text)
    if value < minimum:
        raise ValueError(f"{label} doit être un entier ≥ {minimum} FCFA.")
    return value


def format_xaf(amount: int) -> str:
    sign = "-" if amount < 0 else ""
    absolute = abs(amount)
    grouped = f"{absolute:,}".replace(",", "\u00a0")
    return f"{sign}{grouped} FCFA"

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

DASHBOARD_TIME_ZONE = "Africa/Douala"
DASHBOARD_CUSTOM_MAX_DAYS = 92


def ymd_parts(date: datetime, time_zone: str) -> tuple[int, int, int]:
    local = date.astimezone(ZoneInfo(time_zone))
    return local.year, local.month, local.day


def zoned_midnight_utc(year: int, month: int, day: int, time_zone: str = DASHBOARD_TIME_ZONE) -> datetime:
    zone = ZoneInfo(time_zone)
    local = datetime(year, month, day, 0, 0, 0, tzinfo=zone)
    return local.astimezone(UTC).replace(tzinfo=None)


def add_calendar_days(start: datetime, days: int, time_zone: str = DASHBOARD_TIME_ZONE) -> datetime:
    aware = start.replace(tzinfo=UTC).astimezone(ZoneInfo(time_zone)) + timedelta(days=days)
    return zoned_midnight_utc(aware.year, aware.month, aware.day, time_zone)


def inclusive_day_span(from_ymd: str, to_ymd: str) -> int:
    fy, fm, fd = (int(part) for part in from_ymd.split("-"))
    ty, tm, td = (int(part) for part in to_ymd.split("-"))
    from_utc = datetime(fy, fm, fd, tzinfo=UTC)
    to_utc = datetime(ty, tm, td, tzinfo=UTC)
    return int((to_utc - from_utc).total_seconds() // 86_400) + 1


def resolve_dashboard_range(
    period: str,
    from_ymd: str | None = None,
    to_ymd: str | None = None,
    now: datetime | None = None,
    time_zone: str = DASHBOARD_TIME_ZONE,
) -> dict:
    now = now or datetime.now(UTC)
    today_y, today_m, today_d = ymd_parts(now, time_zone)
    today_start = zoned_midnight_utc(today_y, today_m, today_d, time_zone)
    if period == "today":
        return {
            "from": today_start,
            "toExclusive": add_calendar_days(today_start, 1, time_zone),
            "label": "Aujourd'hui",
        }
    if period == "week":
        weekday = now.astimezone(ZoneInfo(time_zone)).weekday()  # Monday=0
        week_start = add_calendar_days(today_start, -weekday, time_zone)
        return {
            "from": week_start,
            "toExclusive": add_calendar_days(today_start, 1, time_zone),
            "label": "Cette semaine",
        }
    if period == "month":
        month_start = zoned_midnight_utc(today_y, today_m, 1, time_zone)
        return {
            "from": month_start,
            "toExclusive": add_calendar_days(today_start, 1, time_zone),
            "label": "Ce mois",
        }
    if not from_ymd or not to_ymd:
        raise ValueError("Custom dashboard range requires fromYmd and toYmd.")
    fy, fm, fd = (int(part) for part in from_ymd.split("-"))
    ty, tm, td = (int(part) for part in to_ymd.split("-"))
    start = zoned_midnight_utc(fy, fm, fd, time_zone)
    to_start = zoned_midnight_utc(ty, tm, td, time_zone)
    return {
        "from": start,
        "toExclusive": add_calendar_days(to_start, 1, time_zone),
        "label": f"{from_ymd} → {to_ymd}",
    }


def net_line_after_returns(line_total_xaf: int, sale_quantity: int, returned_quantity: int) -> tuple[int, int]:
    returned = min(max(returned_quantity, 0), sale_quantity)
    net_quantity = sale_quantity - returned
    if net_quantity <= 0 or sale_quantity <= 0:
        return 0, 0
    return net_quantity, (line_total_xaf * net_quantity) // sale_quantity


def estimate_sale_margin_xaf(sale_total_xaf: int, refunded_xaf: int, lines: list[dict]) -> int:
    refunded = max(refunded_xaf, 0)
    net_revenue = sale_total_xaf - refunded if sale_total_xaf > refunded else 0
    cost = 0
    for line in lines:
        net_qty, _ = net_line_after_returns(
            line["lineTotalXaf"], line["saleQuantity"], line["returnedQuantity"]
        )
        cost += line["costPriceXaf"] * net_qty
    return net_revenue - cost


def average_basket_xaf(revenue_xaf: int, sale_count: int) -> int | None:
    if sale_count <= 0:
        return None
    return revenue_xaf // sale_count


def is_low_stock(quantity_on_hand: int, threshold: int) -> bool:
    return quantity_on_hand <= threshold

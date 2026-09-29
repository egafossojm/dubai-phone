from dubai_shared.money import format_xaf


def payment_method_label(method: str) -> str:
    return {
        "CASH": "Espèces",
        "ORANGE_MONEY": "Orange Money",
        "MTN_MOBILE_MONEY": "MTN Mobile Money",
    }.get(method, method)


def to_dashboard_payload(input_data: dict) -> dict:
    can_read_financials = input_data["canReadFinancials"]
    can_read_own_ca = input_data["canReadOwnCa"]
    operational = {
        "period": input_data["range"]["period"],
        "periodLabel": input_data["range"]["label"],
        "from": input_data["range"]["from"].isoformat() + "Z",
        "toExclusive": input_data["range"]["toExclusive"].isoformat() + "Z",
        "saleCount": input_data["saleCount"],
        "lowStockThreshold": input_data["lowStockThreshold"],
        "lowStock": input_data["lowStock"],
        "topProducts": [
            {
                "variantId": row["variantId"],
                "sku": row["sku"],
                "name": row["name"],
                "quantity": row["quantity"],
                **(
                    {
                        "revenueXaf": str(row["revenueXaf"]),
                        "revenueLabel": format_xaf(row["revenueXaf"]),
                    }
                    if can_read_financials
                    else {}
                ),
            }
            for row in input_data["topProducts"]
        ],
        "salesBySeller": [
            {
                "userId": row["userId"],
                "fullName": row["fullName"],
                "saleCount": row["saleCount"],
                **(
                    {
                        "revenueXaf": str(row["revenueXaf"]),
                        "revenueLabel": format_xaf(row["revenueXaf"]),
                    }
                    if can_read_financials
                    else {}
                ),
            }
            for row in input_data["salesBySeller"]
        ],
        "recentSales": [
            {
                "id": row["id"],
                "reference": row["reference"],
                "completedAt": row["completedAt"].isoformat() + "Z" if row["completedAt"] else None,
                "soldByName": row["soldByName"],
                "customerName": row["customerName"],
                **(
                    {
                        "totalXaf": str(row["totalXaf"]),
                        "totalLabel": format_xaf(row["totalXaf"]),
                    }
                    if can_read_financials or can_read_own_ca
                    else {}
                ),
            }
            for row in input_data["recentSales"]
        ],
    }
    own_ca = None
    if can_read_own_ca and input_data.get("ownCa"):
        own = input_data["ownCa"]
        basket = own["averageBasketXaf"]
        own_ca = {
            "saleCount": own["saleCount"],
            "caPeriodXaf": str(own["revenueXaf"]),
            "caPeriodLabel": format_xaf(own["revenueXaf"]),
            "averageBasketXaf": str(basket) if basket is not None else None,
            "averageBasketLabel": format_xaf(basket) if basket is not None else "—",
        }
    if not can_read_financials:
        return {
            **operational,
            "canReadFinancials": False,
            "canReadOwnCa": can_read_own_ca,
            "financials": None,
            "ownCa": own_ca,
        }
    return {
        **operational,
        "canReadFinancials": True,
        "canReadOwnCa": False,
        "ownCa": None,
        "financials": {
            "caPeriodXaf": str(input_data["revenueXaf"]),
            "caPeriodLabel": format_xaf(input_data["revenueXaf"]),
            "caTodayXaf": str(input_data["caTodayXaf"]),
            "caTodayLabel": format_xaf(input_data["caTodayXaf"]),
            "caMonthXaf": str(input_data["caMonthXaf"]),
            "caMonthLabel": format_xaf(input_data["caMonthXaf"]),
            "refundsPeriodXaf": str(input_data["refundsPeriodXaf"]),
            "refundsPeriodLabel": format_xaf(input_data["refundsPeriodXaf"]),
            "marginXaf": str(input_data["marginXaf"]),
            "marginLabel": format_xaf(input_data["marginXaf"]),
            "averageBasketXaf": str(input_data["averageBasketXaf"])
            if input_data["averageBasketXaf"] is not None
            else None,
            "averageBasketLabel": format_xaf(input_data["averageBasketXaf"])
            if input_data["averageBasketXaf"] is not None
            else "—",
            "creditOutstandingXaf": str(input_data["creditOutstandingXaf"]),
            "creditOutstandingLabel": format_xaf(input_data["creditOutstandingXaf"]),
            "paymentsByMethod": [
                {
                    "method": row["method"],
                    "methodLabel": payment_method_label(row["method"]),
                    "count": row["count"],
                    "amountXaf": str(row["amountXaf"]),
                    "amountLabel": format_xaf(row["amountXaf"]),
                }
                for row in input_data["paymentsByMethod"]
            ],
        },
    }

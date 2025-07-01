// ==UserScript==
// @name         Scalable Capital Transactions Exporter
// @namespace    http://tampermonkey.net/
// @version      2025-04-10
// @description  Export your Scalable Capital Transactions as a .csv file in German or English, ready to be imported into Portfolio Performance.
// @author       Matthes Voß
// @match        https://*.scalable.capital/broker/transactions*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=scalable.capital
// @grant        GM_registerMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/decimal.js/10.5.0/decimal.min.js
// ==/UserScript==

(function () {
    'use strict';

    GM_registerMenuCommand("Export Transactions CSV DE", function () {
        fetchTransactions("de-DE");
    });

    GM_registerMenuCommand("Export Transactions CSV EN", function () {
        fetchTransactions("en-US");
    });

    function createLoadingBar() {
        const barContainer = document.createElement("div");
        barContainer.id = "scalable-exporter-loading-bar";
        Object.assign(barContainer.style, {
            position: "fixed",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "80%",
            height: "24px",
            backgroundColor: "#ddd",
            borderRadius: "12px",
            zIndex: "9999",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
        });

        const bar = document.createElement("div");
        bar.id = "scalable-exporter-progress";
        Object.assign(bar.style, {
            height: "100%",
            width: "0%",
            backgroundColor: "#4caf50",
            borderRadius: "12px",
            textAlign: "center",
            lineHeight: "24px",
            color: "white",
            fontWeight: "bold",
            transition: "width 0.2s ease"
        });

        barContainer.appendChild(bar);
        document.body.appendChild(barContainer);
    }

    function updateLoadingBar(current, total) {
        const bar = document.getElementById("scalable-exporter-progress");
        if (bar) {
            const percentage = Math.floor((current / total) * 100);
            bar.style.width = `${percentage}%`;
            bar.textContent = `${percentage}%`;
        }
    }

    function removeLoadingBar() {
        const barContainer = document.getElementById("scalable-exporter-loading-bar");
        if (barContainer) {
            barContainer.remove();
        }
    }

    function isObject(obj) {
        return typeof obj === 'object' && obj !== null;
    }

    function getPersonId() {
        function visit(node) {
            if (!node) return null;
    
            if (Array.isArray(node)) {
                for (const subNode of node) {
                    const result = visit(subNode);
                    if (result) return result;
                }
                return null;
            }
    
            if (isObject(node)) {
                if (node.personId) return node.personId;
    
                for (const key in node) {
                    if (["children", "props", "security", "items"].includes(key) || key.startsWith("__reactProps")) {
                        const result = visit(node[key]);
                        if (result) return result;
                    }
                }
            }
    
            if (node.childNodes && typeof node.childNodes.forEach === 'function') {
                for (const child of node.childNodes) {
                    const result = visit(child);
                    if (result) return result;
                }
            }
    
            return null;
        }
    
        return visit(document.body);
    }

    function getPortfolioId() {
        const params = new URLSearchParams(window.location.search);
        return params.get("portfolioId");
    }
    

    async function fetchTransactionDetails(personId, portfolioId, transactionId) {
        const url = "https://de.scalable.capital/broker/api/data";

        const headers = {
            "content-type": "application/json",
            "referer": `https://de.scalable.capital/broker/transactions?portfolioId=${portfolioId}`,
            "x-scacap-features-enabled": "CRYPTO_MULTI_ETP,UNIQUE_SECURITY_ID"
        };

        const body = JSON.stringify([{
            "operationName": "getTransactionDetails",
            "variables": {
                "personId": personId,
                "transactionId": transactionId,
                "portfolioId": portfolioId
            },
            "query": `query getTransactionDetails($personId: ID!, $transactionId: ID!, $portfolioId: ID!) {
            account(id: $personId) {
                id
                brokerPortfolio(id: $portfolioId) {
                    id
                    transactionDetails(id: $transactionId) {
                        ...TransactionDetailsFragment
                        __typename
                    }
                __typename
                }
            __typename
            }
        }

        fragment TransactionDetailsFragment on BrokerTransaction {
            id
            currency
            type
            documents {
                id
                url
                label
                __typename
            }
            lastEventDateTime
            isPending
            isCancellation
            security {
                ...SecurityNameOnlyFragment
                __typename
            }
            transactionReference
            ...SecurityTransactionDetailsFragment
            ...CashTransactionDetailsFragment
            ...NonTradeSecurityTransactionDetailsFragment
            __typename
        }

        fragment SecurityNameOnlyFragment on Security {
            id
            name
            isin
            __typename
        }

        fragment SecurityTransactionDetailsFragment on BrokerSecurityTransaction {
            id
            side
            status
            numberOfShares {
                filled
                total
                __typename
            }
            averagePrice
            totalAmount
            finalisationReason
            limitPrice
            stopPrice
            validUntil
            isCancellationRequested
            tradeTransactionAmounts {
                marketValuation
                taxAmount
                transactionFee
                venueFee
                cryptoSpreadFee
                __typename
            }
            tradingVenue
            fee
            transactionalFee
            taxes
            securityTransactionHistory: transactionHistory {
                state
                timestamp
                numberOfShares {
                    filled
                    total
                    __typename
                }
                executionPrice
                __typename
            }
            orderKind
            __typename
        }

        fragment CashTransactionDetailsFragment on BrokerCashTransaction {
            cashTransactionType
            amount
            description
            cashTransactionHistory: transactionHistory {
                state
                timestamp
                __typename
            }
            nonTradeSecurity: security {
                ...SecurityNameOnlyFragment
                __typename
            }
            sddiDetails {
                fee
                grossAmount
                __typename
            }
            __typename
        }

        fragment NonTradeSecurityTransactionDetailsFragment on BrokerNonTradeSecurityTransaction {
            isin
            nonTradeSecurityTransactionType
            quantity
            nonTradeAveragePrice: averagePrice
            nonTradeSecurityAmount: totalAmount
            description
            nonTradeSecurityTransactionHistory: transactionHistory {
                state
                timestamp
                __typename
            }
            nonTradeSecurity: security {
                ...SecurityNameOnlyFragment
                __typename
            }
            __typename
        }`
        }]);

        const response = await fetch(url, {
            method: "POST",
            headers: headers,
            body: body,
            credentials: "include"
        });

        if (!response.ok) {
            console.error(`Error while fetching details for transaction ${transactionId}:`, response.statusText);
            return null;
        }

        const data = await response.json();
        const transaction = data[0]?.data?.account?.brokerPortfolio?.transactionDetails;

        if (!transaction) {
            console.error(`Found no details for transaction ${transactionId}`);
            return null;
        }

        const fees = (transaction.tradeTransactionAmounts?.transactionFee || 0) +
            (transaction.tradeTransactionAmounts?.venueFee || 0) +
            (transaction.tradeTransactionAmounts?.cryptoSpreadFee || 0);

        const taxes = transaction.tradeTransactionAmounts?.taxAmount || 0;

        return {
            fees: fees,
            taxes: taxes,
            marketValuation: transaction.tradeTransactionAmounts?.marketValuation
        };
    }

    async function fetchTransactions(lang) {
        const personId = getPersonId();
        const portfolioId = getPortfolioId();

        if (!personId || !portfolioId) {
            console.error("Error: Could not find personId or portfolioId.");
            return;
        }

        console.log("Found personId:", personId);
        console.log("Found portfolioId:", portfolioId);

        const url = "https://de.scalable.capital/broker/api/data";

        const headers = {
            "content-type": "application/json",
            "referer": `https://de.scalable.capital/broker/transactions?portfolioId=${portfolioId}`,
            "x-scacap-features-enabled": "CRYPTO_MULTI_ETP,UNIQUE_SECURITY_ID"
        };

        let transactions = [];
        let cursor = null;
        let hasMore = true;

        while (hasMore) {
            console.log("Current cursor:", cursor);

            const body = JSON.stringify([{
                "operationName": "moreTransactions",
                "variables": {
                    "personId": personId,
                    "input": { "pageSize": 50, "type": [], "status": [], "searchTerm": "", "cursor": cursor },
                    "portfolioId": portfolioId
                },
                "query": `query moreTransactions($personId: ID!, $input: BrokerTransactionInput!, $portfolioId: ID!) {
                account(id: $personId) {
                    id
                    brokerPortfolio(id: $portfolioId) {
                        id
                        moreTransactions(input: $input) {
                            ...MoreTransactionsFragment
                            __typename
                        }
                        __typename
                    }
                    __typename
                }
            }

            fragment MoreTransactionsFragment on BrokerTransactionSummaries {
                cursor
                total
                transactions {
                    id
                    currency
                    type
                    status
                    isCancellation
                    lastEventDateTime
                    description
                    ...BrokerCashTransactionSummaryFragment
                    ...BrokerNonTradeSecurityTransactionSummaryFragment
                    ...BrokerSecurityTransactionSummaryFragment
                    __typename
                }
                __typename
            }

            fragment BrokerCashTransactionSummaryFragment on BrokerCashTransactionSummary {
                cashTransactionType
                amount
                relatedIsin
                __typename
            }

            fragment BrokerNonTradeSecurityTransactionSummaryFragment on BrokerNonTradeSecurityTransactionSummary {
                nonTradeSecurityTransactionType
                quantity
                amount
                isin
                __typename
            }

            fragment BrokerSecurityTransactionSummaryFragment on BrokerSecurityTransactionSummary {
                securityTransactionType
                quantity
                amount
                side
                isin
                __typename
            }`
            }]);

            const response = await fetch(url, {
                method: "POST",
                headers: headers,
                body: body,
                credentials: "include"
            });

            if (!response.ok) {
                console.error("Error while fetching transactions:", response.statusText);
                break;
            }

            const data = await response.json();
            const result = data[0]?.data?.account?.brokerPortfolio?.moreTransactions;

            if (result?.transactions?.length > 0) {
                const filteredTransactions = result.transactions.filter(t => t.status === "SETTLED");

                transactions = transactions.concat(filteredTransactions);
                cursor = result.cursor;

                if (cursor === null) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        createLoadingBar();

        const securityTransactions = transactions.filter(t => t.type === "SECURITY_TRANSACTION");
        let loaded = 0;
        const total = securityTransactions.length;

        console.log("Loading details for ", total, " transactions...");
        for (const transaction of securityTransactions) {
            const details = await fetchTransactionDetails(personId, portfolioId, transaction.id);
            if (details) {
                transaction.details = details;
            }
            loaded++;
            updateLoadingBar(loaded, total);
        }

        removeLoadingBar();

        console.log("Transactions loaded:", transactions.length);
        parseToPortfolioPerformanceCSV(transactions, lang);
    }

    function formatLocalDateTime(utcTimestamp, lang) {
        const date = new Date(utcTimestamp);
        return date.toLocaleString(lang, {
            timeZone: "Europe/Berlin",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        });
    }

    function formatNumber(number, lang) {
        if (number === "" || number == null || isNaN(number)) return "";
        const rounded = new Decimal(number).toDecimalPlaces(2).toString();
        return lang === "de-DE" ? rounded.replace(".", ",") : rounded;
    }

    function parseToPortfolioPerformanceCSV(transactions, lang) {
        let csvHeader, csvRows;
        if (lang === "de-DE") {
            csvHeader = "Datum;Uhrzeit;Typ;Wertpapiername;ISIN;Wert;Stück;Buchungswährung;Gebühren;Steuern;Bruttobetrag;Notiz\n";
            csvRows = transactions.map(t => {
                const dateTime = formatLocalDateTime(t.lastEventDateTime, lang);
                const [date, time] = dateTime.split(", ");
                if (t.type === "SECURITY_TRANSACTION") {
                    t.type = JSON.stringify(t.side || "").replace("BUY", "Kauf").replace("SELL", "Verkauf");
                } else if (t.type === "CASH_TRANSACTION") {
                    t.type = JSON.stringify(t.cashTransactionType || "").replace("DEPOSIT", "Einlage").replace("WITHDRAWAL", "Entnahme").replace("TAX_RETURN", "Steuerrückerstattung").replace("DISTRIBUTION", "Dividende").replace("INTEREST", "Zinsen");
                    if (t.cashTransactionType === "DISTRIBUTION") {
                        t.isin = t.relatedIsin;
                    } else {
                        t.id += " " + t.description;
                        t.description = "";
                    }
                }
                return `${date};${time};${t.type || ""};${t.description || ""};${t.isin || ""};${formatNumber(t.amount, lang)};${formatNumber(t.quantity, lang)};${t.currency || ""};${formatNumber(t.details?.fees, lang)};${formatNumber(t.details?.taxes, lang)};${formatNumber(t.details?.marketValuation, lang)};${t.id || ""}`;
            });
        } else if (lang === "en-US") {
            csvHeader = "Date,Time,Type,Security Name,ISIN,Value,Shares,Transaction Currency,Fees,Taxes,Gross Amount,Note\n";
            csvRows = transactions.map(t => {
                const dateTime = formatLocalDateTime(t.lastEventDateTime, lang);
                const [date, time] = dateTime.split(", ");
                if (t.type === "SECURITY_TRANSACTION") {
                    t.type = JSON.stringify(t.side || "").replace("BUY", "Buy").replace("SELL", "Sell");
                } else if (t.type === "CASH_TRANSACTION") {
                    t.type = JSON.stringify(t.cashTransactionType || "").replace("DEPOSIT", "Deposit").replace("WITHDRAWAL", "Removal").replace("TAX_RETURN", "Tax Refund").replace("DISTRIBUTION", "Dividend").replace("INTEREST", "Interest");
                    if (t.cashTransactionType === "DISTRIBUTION") {
                        t.isin = t.relatedIsin;
                    } else {
                        t.id += " " + t.description;
                        t.description = "";
                    }
                }
                return `${date},${time},${t.type || ""},${t.description || ""},${t.isin || ""},${formatNumber(t.amount, lang)},${formatNumber(t.quantity, lang)},${t.currency || ""},${formatNumber(t.details?.fees, lang)},${formatNumber(t.details?.taxes, lang)},${formatNumber(t.details?.marketValuation, lang)},${t.id || ""}`;
            });
        }
        const csvContent = csvHeader + csvRows.join("\n");

        downloadCSV(csvContent);
    }

    function downloadCSV(csvContent) {
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "scalable_transactions_export_" + (new Date().toISOString().split(".")[0]) + ".csv";
        a.click();

        URL.revokeObjectURL(url);
    }
})();

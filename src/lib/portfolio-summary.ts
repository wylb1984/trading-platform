import { PortfolioDerivation, PortfolioHolding, PortfolioSummary } from "@/lib/types";
import { getQuote } from "@/lib/market-data";

export async function summarizePortfolioWithRealQuotes(holdings: PortfolioHolding[]): Promise<PortfolioSummary> {
  const enrichedHoldings = await Promise.all(
    holdings.map(async (holding) => {
      const quote = await getQuote(holding.symbol, holding.market);
      const lastPrice = quote?.price ?? holding.averageCost;
      const marketValue = Number((lastPrice * holding.quantity).toFixed(2));
      const cost = holding.quantity * holding.averageCost;
      const pnl = Number((marketValue - cost).toFixed(2));
      const pnlPct = cost === 0 ? 0 : Number(((pnl / cost) * 100).toFixed(2));

      return {
        ...holding,
        lastPrice,
        marketValue,
        pnl,
        pnlPct
      };
    })
  );

  const totalCost = Number(
    enrichedHoldings.reduce((sum, holding) => sum + holding.quantity * holding.averageCost, 0).toFixed(2)
  );
  const totalValue = Number(enrichedHoldings.reduce((sum, holding) => sum + holding.marketValue, 0).toFixed(2));
  const totalPnl = Number((totalValue - totalCost).toFixed(2));
  const totalPnlPct = totalCost === 0 ? 0 : Number(((totalPnl / totalCost) * 100).toFixed(2));

  return {
    holdings: enrichedHoldings,
    totalCost,
    totalValue,
    totalPnl,
    totalPnlPct,
    allocation: enrichedHoldings.map((holding) => ({
      label: holding.symbol,
      value: totalValue === 0 ? 0 : Number(((holding.marketValue / totalValue) * 100).toFixed(2))
    }))
  };
}

export async function revaluePortfolioDerivation(derivation: PortfolioDerivation): Promise<PortfolioDerivation> {
  const holdingsSummary = await summarizePortfolioWithRealQuotes(derivation.holdings);
  return {
    ...derivation,
    equityValue: holdingsSummary.totalValue,
    totalAccountValue: Number((derivation.cashBalance + holdingsSummary.totalValue).toFixed(2))
  };
}
